export const caddyfileTemplate = (config: any) => `{
    admin off
    auto_https ${config.useHttps ? 'on' : 'off'}
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

# Admin interface (local only)
:2019 {
    respond "Caddy Admin - ${config.name}"
}
`;