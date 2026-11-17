# Dietas App

Aplicativo desktop em português para planejamento alimentar: Electron, Node.js, TypeScript, Vite e uma única página HTML. Funciona offline, sem Excel, banco de dados, servidor de aplicação ou serviços externos. Não usa React nem outros frameworks de interface.

## Executar

Desenvolvimento: **Node.js 22.13+** e npm. No Windows, use Windows 10/11 de 64 bits. A instalação inicial baixa as ferramentas; depois de empacotado, o aplicativo funciona sem internet, Node.js ou Excel.

```bash
npm ci
npm start
```

O projeto foi iniciado a partir do template oficial do Electron Forge. Na versão atual, o comando de criação é `npx create-electron-app@latest nome --template vite --typescript`; a antiga opção `--template=vite-typescript` foi substituída. Configurações `.mts` explicitam ESM.

```bash
npm run typecheck       # TypeScript estrito
npm test                # Vitest, sem abrir janelas
npm run build           # Compila main, preload e a página
npm run check           # Todas as verificações acima
npm run test:e2e         # Abre o Electron e testa os fluxos reais
npm run package         # Pasta executável da plataforma atual
npm run make            # Distribuição da plataforma atual
npm run make:windows    # Squirrel e ZIP; executar em Windows
npm run make:windows:linux # Squirrel e ZIP no Linux com Wine e Mono
```

Execute `npm run build` antes de `npm run test:e2e`. O teste usa Playwright com o próprio Electron; não requer navegador separado. Salva screenshots e um PDF de amostra em `artifacts/`, usando dados temporários. Precisa de sessão gráfica ou Xvfb. O Playwright desativa o sandbox de processo na sessão automatizada; o teste verifica as configurações `contextIsolation`, `nodeIntegration` e `sandbox` da janela. A aplicação distribuída não desativa o sandbox.

Para testar uma distribuição, defina `DIETAS_E2E_APP` com o caminho de `resources/app.asar` antes de executar `npm run test:e2e`. O teste copia o arquivo para uma pasta temporária fora do repositório e abre essa cópia, sem acesso às dependências em `node_modules` do projeto. Os workflows Windows e Linux fazem essa verificação após gerar o pacote.

No Linux são necessárias bibliotecas GTK 3, NSS, GBM, xkbcommon, áudio e dependências. No WSL é necessário WSLg ou servidor X. Essas bibliotecas não são necessárias no Windows. Vite serve arquivos **somente no desenvolvimento**; o executável distribuído carrega arquivos locais via `file://`.

## Uso

1. **Perfil:** sexo usado na fórmula, idade, peso, altura e atividade. Aplicar perfil atualiza os cálculos.
2. **Estratégia:** hipertrofia (+500 kcal), manutenção ou definição (−500 kcal). Cálculo padrão, percentuais personalizados ou gramas. Percentuais somam 100%; no modo gramas, a meta é calculada pelos macros (4/9/4 kcal/g).
3. **Dieta:** oito refeições com nome, horário e até seis alimentos cada. Busca por palavras, com ou sem acentos. Quantidades válidas atualizam imediatamente alimento, refeição e dia. A comparação destaca diferenças superiores a ±10%.
4. **Relatório:** revisão, impressão nativa, PDF, exportar/importar JSON e abrir/excluir dietas. Inclui os oito blocos, inclusive vazios, e gráfico de pizza com a distribuição calórica da estratégia adotada.

No relatório, **Personalizar cabeçalho** permite editar título, subtítulo, nome da pessoa, profissional/contato, cor de destaque e exibição da data. As alterações aparecem imediatamente e são salvas por dieta, inclusive em cópias, importação/exportação JSON e PDF. Título vazio utiliza o nome do plano; dietas antigas abrem com os valores padrão.

O gráfico usa SVG nativo, sem dependências externas, com proteínas em azul (`#4F81BD`), gorduras em vermelho (`#C0504D`) e carboidratos em verde (`#9BBB59`). Os percentuais são calculados pela contribuição calórica dos macros da estratégia (4/9/4 kcal por grama), independentemente dos alimentos adicionados. Legenda, gramas e calorias ficam à direita; dados pessoais ficam à esquerda. As cores e os percentuais são preservados na impressão e no PDF. O relatório não inclui mais a marca “DA”, o rótulo de estratégia da planilha nem o antigo rodapé.

Edite o nome do plano na barra superior. Nova dieta preserva o plano anterior; Duplicar cria uma cópia independente. Limpar remove alimentos, mantendo perfil, estratégia e horários, com confirmação. Alterações válidas são salvas automaticamente; há também Salvar dieta e indicador de estado. Perfil/estratégia só são aplicados pelos respectivos botões. Gravações pendentes são avisadas ao fechar.

O catálogo permite cadastrar, editar e excluir personalizados. Originais são somente leitura; Criar cópia abre um novo personalizado. Alimentos usados em qualquer dieta salva não podem ser excluídos. Editar um personalizado atualiza as dietas que o referenciam. Campos numéricos vazios significam desconhecido e geram aviso. Valores personalizados devem ser referentes a **100 g**.

## Arquivos e recuperação

Dados em `app.getPath('userData')`, normalmente `%APPDATA%\DietasApp\` no Windows:

```text
dietas.json                       # Perfil, estratégia, refeições e configurações
alimentos-personalizados.json     # Catálogo separado dos originais
*.bak                             # Versão anterior completa
*.corrupt-<data>                   # Entrada corrompida preservada
*.interrupted-<data>               # Arquivos de uma gravação interrompida
```

Gravações serializadas usam temporário, sincronização, backup e renomeação. O catálogo é gravado antes das dietas. Se uma queda interromper a gravação entre arquivos, a abertura procura versões consistentes e avisa. Quando não consegue recuperar dados válidos, interrompe a abertura e preserva os arquivos. Exporte cópias para proteção adicional contra falhas de disco.

Exportações incluem `schemaVersion: 1`, dieta e seus personalizados. Importação valida estrutura, medidas, estratégias, horários, limites e referências; cria nova dieta e remapeia IDs personalizados, preservando o catálogo existente. Limites: 500 dietas, 10.000 personalizados, JSON até 20 MB, oito refeições, seis alimentos por refeição, quantidade até 10.000 g.

Em desenvolvimento, `DIETAS_DATA_DIR` isola os dados em outra pasta. O override é ignorado pelo aplicativo empacotado.

## Organização e segurança

`src/electron/`: janela, preload e IPC. O renderer não acessa `fs`, Node.js ou `ipcRenderer`; o preload expõe seis operações específicas. O processo principal valida payloads e frame de origem; caminhos de importação/exportação/PDF são escolhidos por diálogos nativos. Navegação, novas janelas, permissões e rede externa são bloqueadas. Texto inserido é escapado antes de compor HTML. A janela de impressão é isolada e não executa JavaScript.

`src/core/`: estratégia, refeições, nutrição e validação. `src/components/`: interface. `src/services/`: catálogo, arquivos e PDF. O catálogo original é embarcado. O Forge inclui somente bundles e recursos, sem planilhas, referências ou VBA.

As dependências JavaScript de runtime, incluindo `electron-squirrel-startup`, `debug` e `ms`, são incorporadas ao bundle do processo principal. Apenas Electron e módulos nativos do Node são externos. `electron-squirrel-startup` permanece declarado em `dependencies`. O hook `postPackage` do Forge executa `scripts/verify-package.mts` contra o `app.asar` gerado e interrompe a distribuição se houver dependência externa ausente, falha de inicialização ou erro nos quatro eventos Squirrel. A verificação usa Electron e efeitos de sistema simulados; a interface real é testada separadamente com o ASAR isolado.

### Correção da versão 1.0.1

A versão 1.0.0 marcava `electron-squirrel-startup` como externo no Vite, mas não incluía `node_modules` na distribuição. Isso causava `Cannot find module 'electron-squirrel-startup'` ao iniciar a aplicação instalada. A versão 1.0.1 incorpora a dependência e suas transitivas ao `main.cjs`, e adiciona testes de regressão do pacote. Instale o novo `DietasApp Setup.exe` para substituir a versão com falha. Os arquivos de dietas em `%APPDATA%\DietasApp` são mantidos pelo aplicativo.

## Distribuição Windows

Em um terminal **Windows** na pasta do projeto:

```powershell
npm ci
npm run check
npm run test:e2e
npm run make:windows
```

Saída:

```text
out/DietasApp-win32-x64/DietasApp.exe
out/make/squirrel.windows/x64/DietasApp Setup.exe
out/make/squirrel.windows/x64/RELEASES
out/make/squirrel.windows/x64/*-full.nupkg
out/make/zip/win32/x64/*.zip
```

Na versão portátil, mantenha **todos os arquivos** da pasta ao lado de `DietasApp.exe`; copiar apenas o executável não basta. Nome, ícone, atalhos Squirrel, janela e fuses de segurança estão configurados. Não há certificado de assinatura digital configurado.

### Gerar no Linux

Wine e Mono foram instalados **localmente neste checkout**, em `.tools/windows-build/`, porque o `sudo` exige senha. A instalação não altera os pacotes do sistema e está excluída do Git e dos artefatos distribuídos. Inclui Wine 5.0 de 32/64 bits, Mono 6.8, ZIP e suas dependências Ubuntu. Os binários Wine de 32 bits usam o carregador ELF da própria instalação local; não é necessário alterar `/lib` nem usar um wrapper de rastreamento.

Para repetir a geração neste ambiente:

```bash
npm run make:windows:linux
```

O script carrega os caminhos e o prefixo Wine isolado somente no processo de geração. As configurações de Wine, Mono e NuGet também ficam em `.tools/windows-build/`. Essa instalação depende do caminho atual do checkout; movê-lo exige refazer os caminhos do carregador local. Caches de download e os pacotes `.deb` de instalação foram removidos após a configuração; os binários necessários foram preservados.

Em outra instalação Ubuntu/Debian com acesso administrativo, instale as ferramentas do sistema e use o mesmo comando:

```bash
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install --no-install-recommends wine64 wine32 mono-devel zip
npm ci
npm run make:windows:linux
```

O instalador produzido no Linux está em `out/make/squirrel.windows/x64/DietasApp Setup.exe`. O pacote completo e seu manifesto `RELEASES` ficam na mesma pasta; o ZIP portátil oficial do Forge fica em `out/make/zip/win32/x64/`.

O workflow [.github/workflows/windows.yml](.github/workflows/windows.yml) verifica, testa o Electron e gera artefatos em Windows, por push/PR ou execução manual. Está preparado; nenhuma execução remota foi disparada nesta sessão.

## Workflow Linux

O workflow [.github/workflows/linux.yml](.github/workflows/linux.yml) executa em Ubuntu 24.04 x64, em pushes para `main`/`master`, pull requests e execução manual pela aba Actions. Instala as bibliotecas do Electron, executa `npm ci` e `npm run check`, gera a distribuição Linux com Electron Forge e testa seu `app.asar` isolado em uma sessão gráfica virtual Xvfb. O sandbox é desabilitado apenas na sessão de testes automatizados.

O ZIP fica disponível nos artefatos da execução como `DietasApp-Linux-x64`, por 14 dias. Screenshots e o PDF dos testes ficam em `evidencias-linux`, inclusive quando uma etapa falha e há evidências disponíveis. Após extrair o ZIP, execute `./DietasApp` dentro da pasta completa do aplicativo. A distribuição usa o maker ZIP já configurado; não requer Wine nem Mono. Nenhuma execução remota é disparada ao criar o arquivo do workflow.

## Verificações desta implementação

- TypeScript, build e **40 testes Vitest** passaram, incluindo cálculos, gráfico, cabeçalho personalizado, compatibilidade de dietas antigas, persistência e regressões de empacotamento.
- Teste real Electron: cálculos na interface, porções ao vivo, desconhecidos, catálogo personalizado, importação/exportação, PDF, confirmação, reabertura, oito refeições/48 itens e layout de 800 px.
- PDF A4 gerado e texto extraído: **duas páginas**, incluindo a oitava refeição e seu alimento.
- Pacotes **Linux x64 e Windows x64** gerados pelo Forge. `app.asar` conferido: somente bundles e manifesto.
- **Instalador Squirrel Windows x64 gerado com sucesso neste Linux**, usando Wine e Mono locais: `DietasApp Setup.exe`, pacote completo NuGet e `RELEASES`. O ZIP portátil também foi gerado pelo Forge. O instalador e a execução da aplicação ainda precisam de validação em um Windows real.
- Integridade de distribuição conferida: SHA-1 e tamanho do `RELEASES`, CRC do NuGet, correspondência do `app.asar` e pacote embutido no `Setup.exe`. Checksums SHA-256 e resultados em `out/make/windows-build-validation.json`, junto das distribuições finais. Builds intermediários e evidências temporárias dos testes podem ser recriados pelos comandos acima.
- Impressão implementada; envio a impressora física não foi testado nesta sessão.

Documentação oficial: [template Forge](https://www.electronforge.io/templates/vite-%2B-typescript), [plugin Vite](https://www.electronforge.io/config/plugins/vite), [segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security).
