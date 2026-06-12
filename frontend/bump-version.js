import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const newVersion = args[0];

if (!newVersion) {
  console.error("Uso: node bump-version.js <nova-versao>");
  console.error("Exemplo: node bump-version.js 1.0.2");
  process.exit(1);
}

// 1. Atualiza package.json
const pkgPath = path.resolve('./package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json atualizado para ${newVersion}`);

// 2. Atualiza build.gradle do Android
const gradlePath = path.resolve('./android/app/build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');
  
  // Extrai versionCode atual e incrementa
  const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);
  if (versionCodeMatch) {
    const currentCode = parseInt(versionCodeMatch[1], 10);
    const newCode = currentCode + 1;
    
    gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${newCode}`);
    gradleContent = gradleContent.replace(/versionName\s+".*"/, `versionName "${newVersion}"`);
    
    fs.writeFileSync(gradlePath, gradleContent);
    console.log(`✅ android/app/build.gradle atualizado: versionCode ${newCode}, versionName "${newVersion}"`);
  } else {
    console.error("❌ Não foi possível encontrar versionCode no build.gradle");
  }
} else {
  console.warn("⚠️ android/app/build.gradle não encontrado. (Ignorando)");
}

console.log("\n🚀 Versão atualizada! Agora você pode rodar 'npm run build' e construir o APK.");
