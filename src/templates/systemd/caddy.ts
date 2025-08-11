export const caddyContainerUnit = (containersDir: string) => `[Unit]
Description=Caddy Web Server
Wants=caddy.socket
After=network-online.target caddy.socket
Requires=caddy.socket
DefaultDependencies=no

[Container]
ContainerName=caddy
Image=docker.io/library/caddy:2-alpine
Volume=caddy-data:/data
Volume=caddy-config:/config
Volume=${containersDir}/Caddyfile:/etc/caddy/Caddyfile:ro,z
Network=pasta
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
PartOf=caddy.container

[Socket]
ListenStream=80
ListenStream=443
SocketUser=1000
SocketGroup=1000

[Install]
WantedBy=sockets.target
`;

export const caddyDataVolume = `[Volume]
VolumeSize=1G
`;

export const caddyConfigVolume = `[Volume]
VolumeSize=100M
`;
