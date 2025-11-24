export interface SteamProfile {
  steamid: string;
}

export default function SteamProvider(options: any = {}): any {
  return {
    id: "steam",
    name: "Steam",
    type: "oauth",
    version: "2.0",

    authorization: {
      url: "https://steamcommunity.com/openid/login",
      params: {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.claimed_id":
          "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.identity":
          "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.return_to": `${process.env.NEXTAUTH_URL}/api/auth/callback/steam`,
        "openid.realm": process.env.NEXTAUTH_URL,
      },
    },

    token: { url: "" },
    userinfo: { url: "" },

    async profile(profile: SteamProfile) {
      return {
        id: profile.steamid,
      };
    },

    // umožní přidat clientSecret atd. z route.ts
    ...options,
  };
}
