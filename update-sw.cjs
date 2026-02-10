const fs = require('fs');
const path = require('path');

/**
 * Скрипт для обновления Service Worker с актуальными именами файлов после сборки
 */
function updateSWWithBuildFiles() {
  const distDir = './dist';
  const swPath = './public/sw.js';
  
  // Проверяем, существует ли директория dist
  if (!fs.existsSync(distDir)) {
    console.log('Директория dist не найдена. Выполните сборку проекта сначала.');
    return;
  }
  
  // Рекурсивно получаем все файлы из dist
  function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach((file) => {
      if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
        arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
      } else {
        arrayOfFiles.push(path.relative('./dist', path.join(dirPath, file)));
      }
    });
    
    return arrayOfFiles;
  }
  
  const allDistFiles = getAllFiles(distDir);
  
  // Фильтруем JS и CSS файлы
  const jsFiles = allDistFiles.filter(file => file.endsWith('.js') && !file.includes('sw.js'));
  const cssFiles = allDistFiles.filter(file => file.endsWith('.css') && !file.includes('all.min.css'));
  
  // Формируем пути к файлам для кэширования
  const buildJsPaths = jsFiles.map(file => {
    // Убираем лишние слеши и корректируем путь
    const cleanPath = file.replace(/\\/g, '/');
    return `/${cleanPath.startsWith('assets/') ? '' : 'assets/'}${cleanPath}`;
  });
  const buildCssPaths = cssFiles.map(file => {
    // Убираем лишние слеши и корректируем путь
    const cleanPath = file.replace(/\\/g, '/');
    return `/${cleanPath.startsWith('assets/') ? '' : 'assets/'}${cleanPath}`;
  });
  
  // Объединяем все пути
  const buildAssets = [...buildJsPaths, ...buildCssPaths];
  
  // Читаем текущий SW
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Находим секцию с массивом essentialAssets и заменяем её
  const essentialAssetsRegex = /(const essentialAssets = \[)([\s\S]*?)(\/\/ \].*\n])/;
  
  // Формируем новую секцию с файлами
  const newEssentialAssetsSection = `const essentialAssets = [
  '/',
  '/index.html',
  '/style.css',
  '/vendor/hls.js',
  '/favicon.ico',
  '/manifest.json',
  '/assets/fonts/all.min.css',
  '/assets/fonts/fa-solid-900.woff2',
  '/assets/icon-72x72.png',
  '/assets/icon-96x96.png',
  '/assets/icon-128x128.png',
  '/assets/icon-144x144.png',
  '/assets/icon-152x152.png',
  '/assets/icon-192x192.png',
  '/assets/icon-384x384.png',
  '/assets/icon-512x512.png',
  '/assets/logo.png',
  // Добавляем файлы, созданные при сборке
  ${buildAssets.map(file => `'${file}'`).join(',\n  ')}
  // ]
`;

  // Заменяем старую секцию на новую
  swContent = swContent.replace(essentialAssetsRegex, newEssentialAssetsSection);
  
  // Записываем обновленный SW обратно
  fs.writeFileSync(swPath, swContent);
  
  // Логируем только в режиме разработки
  if (process.env.NODE_ENV !== 'production') {
    console.log('Service Worker обновлен с актуальными файлами сборки');
  }
}

updateSWWithBuildFiles();