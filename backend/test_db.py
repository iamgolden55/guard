import asyncio
import django
import os

# Set up Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from core.db import execute_query

async def test_connection():
    try:
        # Simple test query to get PostgreSQL version
        result = await execute_query('SELECT version()')
        print("Database connection successful!")
        print("PostgreSQL version:", result[0]['version'])
        
        # Test query to list all tables
        tables = await execute_query("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        print("\nAvailable tables:")
        for table in tables:
            print(f"- {table['table_name']}")
            
    except Exception as e:
        print("Error connecting to database:", str(e))

if __name__ == "__main__":
    asyncio.run(test_connection()) 