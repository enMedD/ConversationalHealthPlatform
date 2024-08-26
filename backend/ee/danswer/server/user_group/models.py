from uuid import UUID

from pydantic import BaseModel

from danswer.db.models import Teamspace as TeamspaceModel
from danswer.server.documents.models import ConnectorCredentialPairDescriptor
from danswer.server.documents.models import ConnectorSnapshot
from danswer.server.documents.models import CredentialSnapshot
from danswer.server.features.document_set.models import DocumentSet
from danswer.server.features.persona.models import AssistantSnapshot
from danswer.server.manage.models import UserInfo
from danswer.server.manage.models import UserPreferences


class Teamspace(BaseModel):
    id: int
    name: str
    users: list[UserInfo]
    cc_pairs: list[ConnectorCredentialPairDescriptor]
    document_sets: list[DocumentSet]
    assistants: list[AssistantSnapshot]
    is_up_to_date: bool
    is_up_for_deletion: bool

    @classmethod
    def from_model(cls, teamspace_model: TeamspaceModel) -> "Teamspace":
        return cls(
            id=teamspace_model.id,
            name=teamspace_model.name,
            users=[
                UserInfo(
                    id=str(user.id),
                    email=user.email,
                    is_active=user.is_active,
                    is_superuser=user.is_superuser,
                    is_verified=user.is_verified,
                    role=user.role,
                    preferences=UserPreferences(
                        chosen_assistants=user.chosen_assistants
                    ),
                    workspace_id=user.workspace_id,
                    full_name=user.full_name,
                    company_name=user.company_name,
                    company_email=user.company_email,
                    company_billing=user.company_billing,
                    billing_email_address=user.billing_email_address,
                    vat=user.vat,
                )
                for user in teamspace_model.users
            ],
            cc_pairs=[
                ConnectorCredentialPairDescriptor(
                    id=cc_pair_relationship.cc_pair.id,
                    name=cc_pair_relationship.cc_pair.name,
                    connector=ConnectorSnapshot.from_connector_db_model(
                        cc_pair_relationship.cc_pair.connector
                    ),
                    credential=CredentialSnapshot.from_credential_db_model(
                        cc_pair_relationship.cc_pair.credential
                    ),
                )
                for cc_pair_relationship in teamspace_model.cc_pair_relationships
                if cc_pair_relationship.is_current
            ],
            document_sets=[
                DocumentSet.from_model(ds) for ds in teamspace_model.document_sets
            ],
            assistants=[
                AssistantSnapshot.from_model(assistant)
                for assistant in teamspace_model.assistants
            ],
            is_up_to_date=teamspace_model.is_up_to_date,
            is_up_for_deletion=teamspace_model.is_up_for_deletion,
        )


class TeamspaceCreate(BaseModel):
    name: str
    user_ids: list[UUID]
    cc_pair_ids: list[int]


class TeamspaceUpdate(BaseModel):
    user_ids: list[UUID]
    cc_pair_ids: list[int]
