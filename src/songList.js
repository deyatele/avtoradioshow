export async function loadSong() {
  try {
    // 1. Получаем одноразовый токен

    const tokenRes = await fetch('https://avtoradioshow.ru/api/challenge', {method: 'POST'});
    if (!tokenRes.ok) throw new Error('Challenge failed');
    const { token } = await tokenRes.json();

    // 2. Используем токен для запроса данных
    const songRes = await fetch('https://avtoradioshow.ru/api/songs', {
      method: 'GET',
      headers: {
        'X-Api-Token': token,
      }
    });

    if (!songRes.ok) throw new Error('Failed to fetch song');
    const data = await songRes.json();
    console.log('Song loaded:', data);
    return data;
  } catch (err) {
    console.error('Error:', err);
  }
}