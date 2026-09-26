from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.auth import require_admin
from app.api.deps import get_enterprise_analytics_service
from app.schemas.enterprise import (
    CostComponentInput,
    CostComponentResponse,
    MethodologyResponse,
    MethodologyUpdate,
)
from app.services.enterprise_analytics import EnterpriseAnalyticsService

router = APIRouter(tags=["Methodology and costs"])

# Methodology and cost components are shared by every account, so only Radar
# administrators may change them; everyone else reads them.
admin_only = [Depends(require_admin)]


@router.get("/methodology", response_model=MethodologyResponse)
async def get_methodology(
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
) -> MethodologyResponse:
    return MethodologyResponse.model_validate(service.methodology())


@router.put("/methodology", response_model=MethodologyResponse, dependencies=admin_only)
async def update_methodology(
    value: MethodologyUpdate,
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
) -> MethodologyResponse:
    return MethodologyResponse.model_validate(service.update_methodology(value))


@router.get("/cost-components", response_model=list[CostComponentResponse])
async def list_cost_components(
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
) -> list[CostComponentResponse]:
    return [CostComponentResponse.model_validate(row) for row in service.list_cost_components()]


@router.post(
    "/cost-components",
    response_model=CostComponentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=admin_only,
)
async def create_cost_component(
    value: CostComponentInput,
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
) -> CostComponentResponse:
    row = service.create_cost_component(value)
    if row is None:
        raise HTTPException(status_code=409, detail="Cost component limit reached")
    return CostComponentResponse.model_validate(row)


@router.put(
    "/cost-components/{component_id}",
    response_model=CostComponentResponse,
    dependencies=admin_only,
)
async def update_cost_component(
    component_id: str,
    value: CostComponentInput,
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
) -> CostComponentResponse:
    row = service.update_cost_component(component_id, value)
    if row is None:
        raise HTTPException(status_code=404, detail="Cost component not found")
    return CostComponentResponse.model_validate(row)


@router.delete(
    "/cost-components/{component_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=admin_only,
)
async def delete_cost_component(
    component_id: str,
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
) -> Response:
    if not service.delete_cost_component(component_id):
        raise HTTPException(status_code=404, detail="Cost component not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
