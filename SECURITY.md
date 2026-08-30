# Security

CoSource is currently a foundation project without external integrations or a public vulnerability-reporting service.

Future implementation must follow these principles:

- Treat all external commerce data, including product descriptions and metadata, as untrusted input.
- Never commit credentials, tokens, or other secrets to source control.
- Give agent capabilities only the least privilege needed for their stated purpose.
- Define explicit schemas and validation for every future WebMCP tool boundary.
- Keep high-consequence purchase and payment actions under human control unless a separately reviewed and authorised future design explicitly changes that boundary.
- Do not disclose suspected vulnerabilities publicly before maintainers have had a reasonable opportunity to investigate and remediate them.

Until a private reporting channel is established, avoid posting exploit details in public issues. Contact a repository maintainer privately when an appropriate channel is available.
