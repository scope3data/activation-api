-- OAuth Client Registrations Table
-- Stores dynamically registered OAuth client credentials for sales agents
-- Supports RFC 7591 Dynamic Client Registration Protocol

CREATE TABLE IF NOT EXISTS oauth_client_registrations (
  -- Primary key components
  agent_id STRING NOT NULL COMMENT "Sales agent ID that this registration belongs to",
  issuer STRING NOT NULL COMMENT "OAuth issuer domain (e.g., https://publisher.com)",
  
  -- OAuth client credentials (from registration response)
  client_id STRING NOT NULL COMMENT "OAuth client ID issued by the authorization server",
  client_secret_encrypted STRING NOT NULL COMMENT "Base64-encoded encrypted client secret",
  
  -- OAuth configuration
  grant_types ARRAY<STRING> NOT NULL COMMENT "Supported grant types (typically ['client_credentials'])",
  scope STRING COMMENT "Authorized scopes for this client",
  
  -- Registration lifecycle
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() COMMENT "When the client was registered",
  expires_at TIMESTAMP COMMENT "When the client secret expires (if applicable)",
  
  -- Additional metadata from registration response
  metadata JSON COMMENT "Additional client metadata (client_name, contacts, etc.)"
) 
PARTITION BY DATE(registered_at)
CLUSTER BY agent_id, issuer
OPTIONS (
  description = "OAuth 2.0 dynamic client registrations for sales agents. Stores credentials obtained via RFC 7591 Dynamic Client Registration Protocol.",
  labels = [("component", "authentication"), ("protocol", "oauth2")]
)
;

-- Create indexes for efficient lookups
-- Note: BigQuery automatically optimizes clustered columns (agent_id, issuer)

-- Example queries this table supports:
-- 1. Find registration for specific agent + issuer:
--    SELECT * FROM oauth_client_registrations 
--    WHERE agent_id = 'agent123' AND issuer = 'https://publisher.com'
--    ORDER BY registered_at DESC LIMIT 1;

-- 2. Find all registrations for an agent:
--    SELECT issuer, client_id, registered_at, expires_at 
--    FROM oauth_client_registrations 
--    WHERE agent_id = 'agent123'
--    ORDER BY registered_at DESC;

-- 3. Find expiring registrations:
--    SELECT agent_id, issuer, client_id, expires_at
--    FROM oauth_client_registrations 
--    WHERE expires_at IS NOT NULL 
--    AND expires_at < TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
--    ORDER BY expires_at ASC;

-- Schema validation examples:
-- Valid row:
-- INSERT INTO oauth_client_registrations (
--   agent_id, issuer, client_id, client_secret_encrypted, grant_types, scope
-- ) VALUES (
--   'sales-agent-123',
--   'https://publisher.example.com',
--   'client_abc123def456',
--   'ZW5jcnlwdGVkX3NlY3JldA==',  -- base64 encoded
--   ['client_credentials'],
--   'adcp.read adcp.write'
-- );