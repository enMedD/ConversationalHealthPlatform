from pydantic import BaseModel

from enmedd.db.models import Workspace as WorkspaceModel
from enmedd.server.models import MinimalTeamspaceSnapshot
from enmedd.server.models import MinimalWorkspaceSnapshot


class Workspaces(BaseModel):
    """General settings that only apply to the Enterprise Edition of enMedD AI

    NOTE: don't put anything sensitive in here, as this is accessible without auth."""

    id: int = 0  # Default value of 0
    instance_id: int
    workspace_name: str | None = None
    workspace_description: str | None = None
    use_custom_logo: bool = False
    custom_logo: str | None = None
    custom_header_logo: str | None = None
    custom_header_content: str | None = None
    groups: list[MinimalTeamspaceSnapshot]

    @classmethod
    def from_model(cls, workspace_model: WorkspaceModel) -> "Workspaces":
        return cls(
            id=workspace_model.id,
            instance_id=workspace_model.instance_id,
            workspace_name=workspace_model.workspace_name,
            workspace_description=workspace_model.workspace_description,
            use_custom_logo=workspace_model.use_custom_logo,
            custom_logo=workspace_model.custom_logo,
            custom_header_logo=workspace_model.custom_header_logo,
            custom_header_content=workspace_model.custom_header_content,
            groups=[
                MinimalTeamspaceSnapshot(
                    id=teamspace.id,
                    name=teamspace.name,
                    workspace=[
                        MinimalWorkspaceSnapshot(
                            id=workspace.id,
                            workspace_name=workspace.workspace_name,
                        )
                        for workspace in teamspace.workspace
                    ],
                )
                for teamspace in workspace_model.groups
            ],
        )

    def check_validity(self) -> None:
        return


class AnalyticsScriptUpload(BaseModel):
    script: str
    secret_key: str
