export const autheliaContainerUnit = (containersDir: string, secretsDir: string) => `[Unit]
Description=Authelia Authentication Server
After=network-online.target authelia-postgres.container
Wants=network-online.target
Requires=authelia-postgres.container
DefaultDependencies=no

[Container]
ContainerName=authelia
Image=docker.io/authelia/authelia:4
Volume=${containersDir}/authelia-config:/config:ro,z
Volume=authelia-data:/data
Network=podman
PublishPort=9091:9091
Secret=JWT_SECRET
Secret=SESSION_SECRET
Secret=STORAGE_ENCRYPTION_KEY
Secret=STORAGE_PASSWORD
Secret=SMTP_PASSWORD
Secret=POSTGRES_DB,type=env,target=AUTHELIA_STORAGE_POSTGRES_DATABASE
Secret=POSTGRES_USER,type=env,target=AUTHELIA_STORAGE_POSTGRES_USERNAME
Secret=SMTP_ADDRESS,type=env,target=AUTHELIA_NOTIFIER_SMTP_ADDRESS
Secret=SMTP_USERNAME,type=env,target=AUTHELIA_NOTIFIER_SMTP_USERNAME
Secret=SMTP_SENDER,type=env,target=AUTHELIA_NOTIFIER_SMTP_SENDER
Environment=AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET_FILE=/run/secrets/JWT_SECRET
Environment=AUTHELIA_SESSION_SECRET_FILE=/run/secrets/SESSION_SECRET
Environment=AUTHELIA_STORAGE_ENCRYPTION_KEY_FILE=/run/secrets/STORAGE_ENCRYPTION_KEY
Environment=AUTHELIA_STORAGE_POSTGRES_PASSWORD_FILE=/run/secrets/STORAGE_PASSWORD
Environment=AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE=/run/secrets/SMTP_PASSWORD

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