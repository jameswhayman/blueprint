export const coreNetworkUnit = `[Unit]
Description=Core network for infrastructure services

[Network]
NetworkName=core
`;

export const addonNetworkUnit = `[Unit]
Description=Addon network for additional services

[Network]
NetworkName=addon
`;