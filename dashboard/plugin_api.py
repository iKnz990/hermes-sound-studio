"""Documented plugin-local REST compatibility bridge for older Hermes hosts."""
import hashlib
from pathlib import Path
import sys
from fastapi import APIRouter, HTTPException
router=APIRouter()
ROOT=Path(__file__).resolve().parents[1]
KEY='hermes_sonic_studio_'+hashlib.sha256(str(ROOT).casefold().encode()).hexdigest()[:20]
def service():
    module=sys.modules.get(KEY)
    current=getattr(module,'SERVICE',None)
    if current is None:raise HTTPException(503,'Sound Studio native bridge is not active; manual editing and export remain available.')
    try:current._scope()
    except RuntimeError:raise HTTPException(409,'Sound Studio is not active in this scope.') from None
    return current
@router.get('/generation/ready')
def ready():return service().ready()
@router.post('/generation')
def generate(body:dict):
    try:return service().start(body)
    except ValueError:raise HTTPException(400,'Invalid or conflicting generation request.') from None
    except RuntimeError:raise HTTPException(409,'Generation unavailable or already running. No automatic retry.') from None
@router.get('/generation/{request_id}')
def result(request_id:str,session_id:str):
    try:return service().read(request_id,session_id)
    except FileNotFoundError:raise HTTPException(404,'Draft request not found.') from None
    except ValueError:raise HTTPException(400,'Invalid request identity or scope.') from None
