export const autheliaContainerUnit = (containersDir: string, secretsDir: string) => `[Unit]
Description=Authelia Authentication Server
After=network-online.target authelia-postgres.container
Wants=network-online.target
Requires=authelia-postgres.container

[Container]
ContainerName=authelia
Image=docker.io/authelia/authelia:4
Volume=${containersDir}/authelia-config:/config:ro,z
Volume=authelia-data.volume:/data
Network=container.network
PublishPort=9091:9091
Secret=${secretsDir}/authelia_jwt_secret.secret,target=AUTHELIA_JWT_SECRET
Secret=${secretsDir}/authelia_session_secret.secret,target=AUTHELIA_SESSION_SECRET
Secret=${secretsDir}/authelia_storage_encryption_key.secret,target=AUTHELIA_STORAGE_ENCRYPTION_KEY
Secret=${secretsDir}/authelia_postgres_password.secret,target=AUTHELIA_POSTGRES_PASSWORD
Secret=${secretsDir}/authelia_postgres_db.secret,target=AUTHELIA_POSTGRES_DB
Secret=${secretsDir}/authelia_postgres_user.secret,target=AUTHELIA_POSTGRES_USER
Secret=${secretsDir}/smtp_host.secret,target=SMTP_HOST
Secret=${secretsDir}/smtp_port.secret,target=SMTP_PORT
Secret=${secretsDir}/smtp_username.secret,target=SMTP_USERNAME
Secret=${secretsDir}/smtp_password.secret,target=SMTP_PASSWORD
Secret=${secretsDir}/smtp_sender.secret,target=SMTP_SENDER

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=60s

[Install]
WantedBy=default.target
`;

export const autheliaDataVolume = `[Volume]
VolumeSize=500M
`;