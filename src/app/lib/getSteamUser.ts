export async function getSteamUser(steamId: string) {
  const apiKey = process.env.STEAM_API_KEY;

  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`
  );

  const data = await res.json();
  const user = data?.response?.players?.[0];

  if (!user) return null;

  return {
    username: user.personaname,
    avatar: user.avatarfull,
  };
}
