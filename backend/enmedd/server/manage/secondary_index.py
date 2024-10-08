from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session

from enmedd.auth.users import current_admin_user
from enmedd.auth.users import current_user
from enmedd.configs.app_configs import DISABLE_INDEX_UPDATE_ON_SWAP
from enmedd.db.connector_credential_pair import get_connector_credential_pairs
from enmedd.db.connector_credential_pair import resync_cc_pair
from enmedd.db.embedding_model import create_embedding_model
from enmedd.db.embedding_model import get_current_db_embedding_model
from enmedd.db.embedding_model import get_secondary_db_embedding_model
from enmedd.db.embedding_model import update_embedding_model_status
from enmedd.db.engine import get_session
from enmedd.db.index_attempt import expire_index_attempts
from enmedd.db.models import IndexModelStatus
from enmedd.db.models import User
from enmedd.document_index.factory import get_default_document_index
from enmedd.indexing.models import EmbeddingModelDetail
from enmedd.server.manage.models import FullModelVersionResponse
from enmedd.server.models import IdReturn
from enmedd.utils.logger import setup_logger

router = APIRouter(prefix="/secondary-index")
logger = setup_logger()


@router.post("/set-new-embedding-model")
def set_new_embedding_model(
    embed_model_details: EmbeddingModelDetail,
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> IdReturn:
    """Creates a new EmbeddingModel row and cancels the previous secondary indexing if any
    Gives an error if the same model name is used as the current or secondary index
    """
    current_model = get_current_db_embedding_model(db_session)

    if embed_model_details.model_name == current_model.model_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New embedding model is the same as the currently active one.",
        )

    secondary_model = get_secondary_db_embedding_model(db_session)

    if secondary_model:
        if embed_model_details.model_name == secondary_model.model_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Already reindexing with {secondary_model.model_name}",
            )

        # Cancel any background indexing jobs
        expire_index_attempts(
            embedding_model_id=secondary_model.id, db_session=db_session
        )

        # Mark previous model as a past model directly
        update_embedding_model_status(
            embedding_model=secondary_model,
            new_status=IndexModelStatus.PAST,
            db_session=db_session,
        )

    new_model = create_embedding_model(
        model_details=embed_model_details,
        db_session=db_session,
    )

    # Ensure Vespa has the new index immediately
    document_index = get_default_document_index(
        primary_index_name=current_model.index_name,
        secondary_index_name=new_model.index_name,
    )
    document_index.ensure_indices_exist(
        index_embedding_dim=current_model.model_dim,
        secondary_index_embedding_dim=new_model.model_dim,
    )

    # Pause index attempts for the currently in use index to preserve resources
    if DISABLE_INDEX_UPDATE_ON_SWAP:
        expire_index_attempts(
            embedding_model_id=current_model.id, db_session=db_session
        )
        for cc_pair in get_connector_credential_pairs(db_session):
            resync_cc_pair(cc_pair, db_session=db_session)

    return IdReturn(id=new_model.id)


@router.post("/cancel-new-embedding")
def cancel_new_embedding(
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> None:
    secondary_model = get_secondary_db_embedding_model(db_session)

    if secondary_model:
        expire_index_attempts(
            embedding_model_id=secondary_model.id, db_session=db_session
        )

        update_embedding_model_status(
            embedding_model=secondary_model,
            new_status=IndexModelStatus.PAST,
            db_session=db_session,
        )


@router.get("/get-current-embedding-model")
def get_current_embedding_model(
    _: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> EmbeddingModelDetail:
    current_model = get_current_db_embedding_model(db_session)
    return EmbeddingModelDetail.from_model(current_model)


@router.get("/get-secondary-embedding-model")
def get_secondary_embedding_model(
    _: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> EmbeddingModelDetail | None:
    next_model = get_secondary_db_embedding_model(db_session)
    if not next_model:
        return None

    return EmbeddingModelDetail.from_model(next_model)


@router.get("/get-embedding-models")
def get_embedding_models(
    _: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> FullModelVersionResponse:
    current_model = get_current_db_embedding_model(db_session)
    next_model = get_secondary_db_embedding_model(db_session)
    return FullModelVersionResponse(
        current_model=EmbeddingModelDetail.from_model(current_model),
        secondary_model=EmbeddingModelDetail.from_model(next_model)
        if next_model
        else None,
    )
