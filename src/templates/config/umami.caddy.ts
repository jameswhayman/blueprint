export const umamiCaddyfileTemplate = (config: any) => `# Umami Analytics
analytics.${config.domain} {
    # Authelia authentication
    forward_auth authelia:9091 {
        uri /api/verify?rd=https://analytics.${config.domain}
        copy_headers Remote-User Remote-Groups Remote-Name Remote-Email
    }
    
    reverse_proxy umami:3000
    log
}
`;