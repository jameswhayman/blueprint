export const caddyfileTemplate = (config: any) => `{
    admin off
}

${config.domain} {
    respond "Hello from ${config.name}! 🚀"
    
    # Health check endpoint
    handle /health {
        respond "OK" 200
    }
    
    # Authelia forward auth endpoint (if enabled)
    handle /auth* {
        reverse_proxy authelia:9091
    }
}
`;
