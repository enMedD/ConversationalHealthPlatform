from uuid import UUID

from pydantic import BaseModel

from enmedd.db.models import DocumentSet as DocumentSetDBModel
from enmedd.server.documents.models import ConnectorCredentialPairDescriptor
from enmedd.server.documents.models import ConnectorSnapshot
from enmedd.server.documents.models import CredentialSnapshot


class DocumentSetCreationRequest(BaseModel):
    name: str
    description: str
    cc_pair_ids: list[int]
    is_public: bool
    # For Private Document Sets, who should be able to access these
    users: list[UUID] | None = None
    groups: list[int] | None = None


class DocumentSetUpdateRequest(BaseModel):
    id: int
    description: str
    cc_pair_ids: list[int]
    is_public: bool
    # For Private Document Sets, who should be able to access these
    users: list[UUID]
    groups: list[int]


class CheckDocSetPublicRequest(BaseModel):
    """Note that this does not mean that the Document Set itself is to be viewable by everyone
    Rather, this refers to the CC-Pairs in the Document Set, and if every CC-Pair is public
    """

    document_set_ids: list[int]


class CheckDocSetPublicResponse(BaseModel):
    is_public: bool


class DocumentSet(BaseModel):
    id: int
    name: str
    description: str
    cc_pair_descriptors: list[ConnectorCredentialPairDescriptor]
    is_up_to_date: bool
    contains_non_public: bool
    is_public: bool
    # For Private Document Sets, who should be able to access these
    users: list[UUID]
    groups: list[int]

    @classmethod
    def from_model(cls, document_set_model: DocumentSetDBModel) -> "DocumentSet":
        return cls(
            id=document_set_model.id,
            name=document_set_model.name,
            description=document_set_model.description,
            contains_non_public=any(
                [
                    not cc_pair.is_public
                    for cc_pair in document_set_model.connector_credential_pairs
                ]
            ),
            cc_pair_descriptors=[
                ConnectorCredentialPairDescriptor(
                    id=cc_pair.id,
                    name=cc_pair.name,
                    connector=ConnectorSnapshot.from_connector_db_model(
                        cc_pair.connector
                    ),
                    credential=CredentialSnapshot.from_credential_db_model(
                        cc_pair.credential
                    ),
                )
                for cc_pair in document_set_model.connector_credential_pairs
            ],
            is_up_to_date=document_set_model.is_up_to_date,
            is_public=document_set_model.is_public,
            users=[user.id for user in document_set_model.users],
            groups=[group.id for group in document_set_model.groups],
        )
