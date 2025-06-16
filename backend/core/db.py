import asyncpg
import asyncio
from django.conf import settings
from contextlib import asynccontextmanager

_pool = None

async def get_pool():
    """Get or create the database connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(**settings.ASYNCPG_DATABASE)
    return _pool

@asynccontextmanager
async def get_connection():
    """Get a connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as connection:
        yield connection

async def close_pool():
    """Close the database connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None

# Example query function
async def execute_query(query: str, *args):
    """Execute a query and return all results."""
    async with get_connection() as conn:
        return await conn.fetch(query, *args)

# Example transaction function
@asynccontextmanager
async def transaction():
    """Create a transaction context."""
    async with get_connection() as conn:
        async with conn.transaction():
            yield conn 