# ⚠️ 脆弱性 5: コンテナ監査 (NIST SP 800-190) に抵触する Dockerfile
# - latest タグの使用 (ビルドの決定論的再現性が失われ、脆弱なバージョンが混入するリスク)
# - USER root (デフォルトユーザーのまま実行するため、ホストOS乗っ取りリスク)
FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# 危険：root 権限のまま実行される
CMD [ "node", "app.js" ]
