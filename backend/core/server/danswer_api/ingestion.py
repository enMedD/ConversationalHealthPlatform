from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.configs.constants import DocumentSource
from core.connectors.models import Document
from core.connectors.models import IndexAttemptMetadata
from core.db.connector_credential_pair import get_connector_credential_pair_from_id
from core.db.document import get_documents_by_cc_pair
from core.db.document import get_ingestion_documents
from core.db.embedding_model import get_current_db_embedding_model
from core.db.embedding_model import get_secondary_db_embedding_model
from core.db.engine import get_session
from core.document_index.document_index_utils import get_both_index_names
from core.document_index.factory import get_default_document_index
from core.indexing.embedder import DefaultIndexingEmbedder
from core.indexing.indexing_pipeline import build_indexing_pipeline
from core.server.danswer_api.models import DocMinimalInfo
from core.server.danswer_api.models import IngestionDocument
from core.server.danswer_api.models import IngestionResult
from core.utils.logger import setup_logger
from ee.enmedd.auth.users import api_key_dep

logger = setup_logger()

# not using /api to avoid confusion with nginx api path routing
router = APIRouter(prefix="/enmedd-api")


@router.get("/connector-docs/{cc_pair_id}")
def get_docs_by_connector_credential_pair(
    cc_pair_id: int,
    _: str = Depends(api_key_dep),
    db_session: Session = Depends(get_session),
) -> list[DocMinimalInfo]:
    db_docs = get_documents_by_cc_pair(cc_pair_id=cc_pair_id, db_session=db_session)
    return [
        DocMinimalInfo(
            document_id=doc.id,
            semantic_id=doc.semantic_id,
            link=doc.link,
        )
        for doc in db_docs
    ]


@router.get("/ingestion")
def get_ingestion_docs(
    _: str = Depends(api_key_dep),
    db_session: Session = Depends(get_session),
) -> list[DocMinimalInfo]:
    db_docs = get_ingestion_documents(db_session)
    return [
        DocMinimalInfo(
            document_id=doc.id,
            semantic_id=doc.semantic_id,
            link=doc.link,
        )
        for doc in db_docs
    ]


@router.post("/ingestion")
def upsert_ingestion_doc(
    doc_info: IngestionDocument,
    _: str = Depends(api_key_dep),
    db_session: Session = Depends(get_session),
) -> IngestionResult:
    doc_info.document.from_ingestion_api = True

    document = Document.from_base(doc_info.document)

    # TODO once the frontend is updated with this enum, remove this logic
    if document.source == DocumentSource.INGESTION_API:
        document.source = DocumentSource.FILE

    cc_pair = get_connector_credential_pair_from_id(
        cc_pair_id=doc_info.cc_pair_id or 0, db_session=db_session
    )
    if cc_pair is None:
        raise HTTPException(
            status_code=400, detail="Connector-Credential Pair specified does not exist"
        )

    # Need to index for both the primary and secondary index if possible
    curr_ind_name, sec_ind_name = get_both_index_names(db_session)
    curr_doc_index = get_default_document_index(
        primary_index_name=curr_ind_name, secondary_index_name=None
    )

    db_embedding_model = get_current_db_embedding_model(db_session)

    index_embedding_model = DefaultIndexingEmbedder(
        model_name=db_embedding_model.model_name,
        normalize=db_embedding_model.normalize,
        query_prefix=db_embedding_model.query_prefix,
        passage_prefix=db_embedding_model.passage_prefix,
    )

    indexing_pipeline = build_indexing_pipeline(
        embedder=index_embedding_model,
        document_index=curr_doc_index,
        ignore_time_skip=True,
        db_session=db_session,
    )

    new_doc, chunks = indexing_pipeline(
        documents=[document],
        index_attempt_metadata=IndexAttemptMetadata(
            connector_id=cc_pair.connector_id,
            credential_id=cc_pair.credential_id,
        ),
    )

    # If there's a secondary index being built, index the doc but don't use it for return here
    if sec_ind_name:
        sec_doc_index = get_default_document_index(
            primary_index_name=curr_ind_name, secondary_index_name=None
        )

        sec_db_embedding_model = get_secondary_db_embedding_model(db_session)

        if sec_db_embedding_model is None:
            # Should not ever happen
            raise RuntimeError(
                "Secondary index exists but no embedding model configured"
            )

        new_index_embedding_model = DefaultIndexingEmbedder(
            model_name=sec_db_embedding_model.model_name,
            normalize=sec_db_embedding_model.normalize,
            query_prefix=sec_db_embedding_model.query_prefix,
            passage_prefix=sec_db_embedding_model.passage_prefix,
        )

        sec_ind_pipeline = build_indexing_pipeline(
            embedder=new_index_embedding_model,
            document_index=sec_doc_index,
            ignore_time_skip=True,
            db_session=db_session,
        )

        sec_ind_pipeline(
            documents=[document],
            index_attempt_metadata=IndexAttemptMetadata(
                connector_id=cc_pair.connector_id,
                credential_id=cc_pair.credential_id,
            ),
        )

    return IngestionResult(document_id=document.id, already_existed=not bool(new_doc))
