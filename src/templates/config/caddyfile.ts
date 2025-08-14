export const caddyfileTemplate = (config: any) => `{
    # Default bindings for socket activation
    # fd/3: HTTP port 80
    # fd/4: HTTPS port 443 (TCP for H1/H2)  
    # fdgram/5: HTTPS port 443 (UDP for H3/QUIC)
    default_bind fd/4 {
        protocols h1 h2
    }
    default_bind fdgram/5 {
        protocols h3
    }
    admin off
}

# HTTP redirect to HTTPS (port 80 via fd/3)
http:// {
    bind fd/3 {
        protocols h1 h2
    }
    redir https://{host}{uri} permanent
    log
}

# Main domain
${config.domain} {
    respond "Hello from ${config.name}! 🚀"
    
    handle /health {
        respond "OK" 200
    }
    log
}

# Authelia admin interface
admin.${config.domain} {
    reverse_proxy authelia:9091
    log
}

# Localhost for testing (HTTPS with internal cert)
https://localhost {
    tls internal
    respond "Welcome to ${config.name}! Server is running locally. 🚀"
    
    handle /health {
        respond "OK" 200
    }
    log
}

# Import addon service configurations
import /etc/caddy/caddyfiles/*.caddy
`;
