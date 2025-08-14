export const umamiNetworkUnit = `[Unit]
Description=Umami Analytics Network
Before=network-online.target

[Network]
NetworkName=umami

[Install]
WantedBy=default.target
`;