package dev.pradaria.pacote;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceResponse;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * O jogo guardado dentro do app.
 *
 * O WebView abre https://pradaria.pages.dev normalmente, mas cada arquivo do jogo (html, js, css, imagens)
 * sai daqui do aparelho em vez da internet: o app abre na hora e funciona sem internet. Só /api/ (contas,
 * mundos online, salas) vai para a rede. Como o endereço continua o do site, o login, o mundo salvo no
 * aparelho e o online funcionam igual ao navegador.
 *
 * Atualização: com internet, o app confere /app-pacote.json no site. Se o jogo no ar for mais novo,
 * baixa só os arquivos que mudaram (conferindo o sha256 de cada um) para uma pasta nova e passa a usar
 * essa pasta na próxima vez que o app abrir. Se algo falhar no meio, nada muda.
 */
public class Pacote {
    public static final String SITE = "pradaria.pages.dev";
    private static final String TAG = "PradariaPacote";
    private static final String LISTA = "app-pacote.json";

    private final Context ctx;
    private final AssetManager assets;
    private final int versaoApp;
    /** pasta com o jogo baixado (versão mais nova que a do APK), ou null = usa o que veio no APK */
    private final File pasta;
    private final JSONObject lista;
    private volatile boolean conferindo = false;

    public Pacote(Context c, int versaoApp) {
        ctx = c.getApplicationContext();
        assets = ctx.getAssets();
        this.versaoApp = versaoApp;
        JSONObject doApk = lerJson(abrirAsset(LISTA));
        File escolhida = null;
        JSONObject listaEscolhida = doApk;
        try {
            String[] ativo = lerTexto(new File(ctx.getFilesDir(), "pacote-ativo.txt")).trim().split(" ");
            File p = new File(ctx.getFilesDir(), "pacote-" + Integer.parseInt(ativo[0]));
            JSONObject l = lerJson(new FileInputStream(new File(p, LISTA)));
            // APK novo instalado por cima: a pasta baixada foi feita para o APK antigo, volta para o do APK
            if (Integer.parseInt(ativo[1]) == versaoApp && l != null && numero(l) > numero(doApk)) {
                escolhida = p;
                listaEscolhida = l;
            }
        } catch (Exception e) {
            // sem pasta baixada: usa o jogo do APK
        }
        pasta = escolhida;
        lista = listaEscolhida;
        Log.i(TAG, "jogo: versão " + numero(lista) + (pasta != null ? " (baixada)" : " (do app)"));
    }

    public int numeroAtual() {
        return numero(lista);
    }

    // ---------- servir os arquivos para o WebView ----------

    /** devolve o arquivo do jogo para este endereço, ou null para deixar ir para a internet */
    public WebResourceResponse responder(Uri u, String metodo) {
        if (u == null || !SITE.equals(u.getHost()) || !"https".equals(u.getScheme())) return null;
        if (metodo != null && !"GET".equalsIgnoreCase(metodo)) return null;
        String caminho = u.getPath() == null ? "/" : u.getPath();
        if (caminho.startsWith("/api/") || caminho.equals("/api")) return null;
        // o app não usa service worker (o jogo já está todo aqui)
        if (caminho.equals("/sw.js")) return naoAchou();
        String arq = achar(caminho);
        if (arq == null) return naoAchou();
        InputStream in = abrir(arq);
        if (in == null) return naoAchou();
        Map<String, String> cab = new HashMap<>();
        cab.put("Cache-Control", "no-cache");
        cab.put("Access-Control-Allow-Origin", "https://" + SITE);
        return new WebResourceResponse(tipo(arq), tipo(arq).startsWith("text/") || tipo(arq).endsWith("json") || tipo(arq).endsWith("javascript") ? "utf-8" : null,
                200, "OK", cab, in);
    }

    /** o mesmo caminho que o Cloudflare Pages entende: / → index.html, /xadrez → xadrez.html, /tv → index.html */
    private String achar(String caminho) {
        String c = Uri.decode(caminho);
        if (c.contains("..")) return null;
        while (c.startsWith("/")) c = c.substring(1);
        if (c.endsWith("/")) c = c.substring(0, c.length() - 1);
        if (c.isEmpty() || c.equals("tv") || c.equals("index")) return "index.html";
        if (existe(c) && c.contains(".")) return c;
        if (existe(c + ".html")) return c + ".html";
        if (existe(c + "/index.html")) return c + "/index.html";
        return existe(c) ? c : null;
    }

    private boolean existe(String arq) {
        if (pasta != null) return new File(pasta, arq).isFile();
        try (InputStream in = assets.open("jogo/" + arq)) {
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    private InputStream abrir(String arq) {
        try {
            return pasta != null ? new FileInputStream(new File(pasta, arq)) : assets.open("jogo/" + arq);
        } catch (IOException e) {
            return null;
        }
    }

    private InputStream abrirAsset(String arq) {
        try {
            return assets.open("jogo/" + arq);
        } catch (IOException e) {
            return null;
        }
    }

    private static WebResourceResponse naoAchou() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(),
                new ByteArrayInputStream("Não achei".getBytes(StandardCharsets.UTF_8)));
    }

    private static String tipo(String arq) {
        String a = arq.toLowerCase();
        if (a.endsWith(".html")) return "text/html";
        if (a.endsWith(".js") || a.endsWith(".mjs")) return "text/javascript";
        if (a.endsWith(".css")) return "text/css";
        if (a.endsWith(".json")) return "application/json";
        if (a.endsWith(".webmanifest")) return "application/manifest+json";
        if (a.endsWith(".svg")) return "image/svg+xml";
        if (a.endsWith(".png")) return "image/png";
        if (a.endsWith(".jpg") || a.endsWith(".jpeg")) return "image/jpeg";
        if (a.endsWith(".webp")) return "image/webp";
        if (a.endsWith(".ico")) return "image/x-icon";
        if (a.endsWith(".wasm")) return "application/wasm";
        if (a.endsWith(".woff2")) return "font/woff2";
        if (a.endsWith(".mp3")) return "audio/mpeg";
        if (a.endsWith(".ogg")) return "audio/ogg";
        if (a.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    // ---------- atualizar pela internet ----------

    /** confere em segundo plano se o jogo no ar é mais novo e baixa (vale na próxima vez que o app abrir) */
    public void conferirAtualizacao() {
        if (conferindo) return;
        conferindo = true;
        new Thread(() -> {
            try {
                atualizar();
            } catch (Exception e) {
                Log.i(TAG, "não atualizou agora: " + e);
            } finally {
                conferindo = false;
            }
        }, "pradaria-atualizar").start();
    }

    private void atualizar() throws Exception {
        String txt = new String(baixar("/" + LISTA + "?t=" + System.currentTimeMillis()), StandardCharsets.UTF_8).trim();
        // site publicado antes do app-pacote.json existir: o Cloudflare devolve a página do jogo no lugar
        if (!txt.startsWith("{")) {
            Log.i(TAG, "não atualizou agora: o site ainda não tem a lista do jogo para o app");
            return;
        }
        JSONObject nova = new JSONObject(txt);
        int n = numero(nova);
        File ativoTxt = new File(ctx.getFilesDir(), "pacote-ativo.txt");
        int jaBaixado = -1;
        try {
            String[] a = lerTexto(ativoTxt).trim().split(" ");
            if (Integer.parseInt(a[1]) == versaoApp) jaBaixado = Integer.parseInt(a[0]);
        } catch (Exception e) { /* nada baixado */ }
        if (n <= numero(lista) || n <= jaBaixado) {
            Log.i(TAG, "jogo em dia (" + numero(lista) + ", no ar " + n + ")");
            return;
        }
        Log.i(TAG, "baixando o jogo " + n);
        File tmp = new File(ctx.getFilesDir(), "pacote-baixando");
        apagar(tmp);
        if (!tmp.mkdirs()) throw new IOException("sem espaço");
        JSONObject arqs = nova.getJSONObject("arquivos");
        JSONObject meus = lista != null ? lista.optJSONObject("arquivos") : null;
        int baixados = 0;
        for (Iterator<String> it = arqs.keys(); it.hasNext(); ) {
            String arq = it.next();
            if (arq.contains("..") || arq.startsWith("/")) throw new IOException("nome estranho: " + arq);
            String sha = arqs.getJSONObject(arq).getString("sha256");
            File dest = new File(tmp, arq);
            File pai = dest.getParentFile();
            if (pai != null && !pai.isDirectory() && !pai.mkdirs()) throw new IOException("sem pasta");
            byte[] dados = null;
            // o arquivo não mudou: copia o que já está no aparelho
            if (meus != null && meus.optJSONObject(arq) != null && sha.equals(meus.getJSONObject(arq).optString("sha256"))) {
                InputStream in = abrir(arq);
                if (in != null) dados = lerTudo(in);
            }
            if (dados == null || !sha.equals(sha256(dados))) {
                dados = baixar("/" + arq.replace(" ", "%20") + "?v=" + n);
                baixados++;
            }
            if (!sha.equals(sha256(dados))) throw new IOException("arquivo veio errado: " + arq);
            try (OutputStream out = new FileOutputStream(dest)) {
                out.write(dados);
            }
        }
        try (OutputStream out = new FileOutputStream(new File(tmp, LISTA))) {
            out.write(nova.toString().getBytes(StandardCharsets.UTF_8));
        }
        File fim = new File(ctx.getFilesDir(), "pacote-" + n);
        apagar(fim);
        if (!tmp.renameTo(fim)) throw new IOException("não renomeou");
        try (OutputStream out = new FileOutputStream(ativoTxt)) {
            out.write((n + " " + versaoApp).getBytes(StandardCharsets.UTF_8));
        }
        // limpa versões antigas (menos a que está aberta agora)
        File[] todas = ctx.getFilesDir().listFiles();
        if (todas != null) for (File f : todas) {
            if (f.getName().startsWith("pacote-") && f.isDirectory() && !f.equals(fim) && !f.equals(pasta)) apagar(f);
        }
        Log.i(TAG, "jogo " + n + " pronto (" + baixados + " arquivos baixados); vale ao abrir o app de novo");
    }

    private static byte[] baixar(String caminho) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL("https://" + SITE + caminho).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(20000);
        c.setRequestProperty("Cache-Control", "no-cache");
        c.setInstanceFollowRedirects(true);
        try {
            int cod = c.getResponseCode();
            if (cod != 200) throw new IOException("HTTP " + cod + " em " + caminho);
            return lerTudo(c.getInputStream());
        } finally {
            c.disconnect();
        }
    }

    // ---------- ajudantes ----------

    private static int numero(JSONObject l) {
        if (l == null) return 0;
        try {
            return Integer.parseInt(l.optString("numero", "0"));
        } catch (NumberFormatException e) {
            return 0; // "teste": APK feito fora do GitHub Actions
        }
    }

    private static JSONObject lerJson(InputStream in) {
        if (in == null) return null;
        try {
            return new JSONObject(new String(lerTudo(in), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }

    private static String lerTexto(File f) throws IOException {
        return new String(lerTudo(new FileInputStream(f)), StandardCharsets.UTF_8);
    }

    private static byte[] lerTudo(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = i.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        }
    }

    private static String sha256(byte[] d) throws Exception {
        byte[] h = MessageDigest.getInstance("SHA-256").digest(d);
        StringBuilder s = new StringBuilder();
        for (byte x : h) s.append(String.format("%02x", x));
        return s.toString();
    }

    private static void apagar(File f) {
        if (f == null || !f.exists()) return;
        File[] fs = f.listFiles();
        if (fs != null) for (File x : fs) apagar(x);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
