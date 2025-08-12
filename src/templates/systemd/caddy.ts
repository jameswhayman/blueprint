export const caddyContainerUnit = (containersDir: string) => `[Unit]
Description=Caddy Web Server
After=network-online.target caddy.socket core.network addon.network
Requires=caddy.socket core.network addon.network

[Container]
ContainerName=caddy
Image=docker.io/library/caddy:2-alpine
Volume=caddy-data:/data
Volume=caddy-config:/config
Volume=${containersDir}/Caddyfile:/etc/caddy/Caddyfile:ro,z
Network=core
Network=addon
Exec=/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=900

[Install]
WantedBy=default.target
`;

export const caddySocketUnit = `[Unit]
Description=Caddy Web Server Socket

[Socket]
BindIPv6Only=both

### Sockets for the HTTP reverse proxy
# fd/3 - HTTP port 80
ListenStream=[::]:80

# fd/4 - HTTPS port 443 (TCP)
ListenStream=[::]:443

# fdgram/5 - HTTPS port 443 (UDP for QUIC/H3)
ListenDatagram=[::]:443

[Install]
WantedBy=sockets.target
`;

export const caddyDataVolume = `[Volume]
VolumeSize=1G
`;

export const caddyConfigVolume = `[Volume]
VolumeSize=100M
`;
