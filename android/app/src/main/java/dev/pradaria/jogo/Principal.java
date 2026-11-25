package dev.pradaria.jogo;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import dev.pradaria.pacote.Pacote;

/**
 * App do Pradaria para tablet e celular: o jogo inteiro vem dentro do app (Pacote) e abre num WebView em
 * tela cheia. Funciona sem internet (mundo salvo no aparelho); com internet, entra na conta e joga online
 * como no site, e o jogo se atualiza sozinho (baixa o que mudou e usa na próxima vez que abrir).
 */
public class Principal extends Activity {
    private static final int PEDIDO_ARQUIVO = 1, PEDIDO_SALVAR = 2, PEDIDO_MICROFONE = 3;

    private FrameLayout raiz;
    private WebView web;
    private Pacote pacote;
    private ValueCallback<Uri[]> escolhaArquivo;
    private PermissionRequest pedidoMicrofone;
    private String textoParaSalvar;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        raiz = new FrameLayout(this);
        setContentView(raiz);
        telaCheia();
        pacote = new Pacote(this, versaoCodigo());
        criarWeb();
        if (web == null) return;
        if (salvo == null || web.restoreState(salvo) == null) web.loadUrl(endereco(getIntent()));
    }

    /** o endereço que o app abre: o do convite (link do Pradaria) ou a tela inicial */
    private String endereco(Intent i) {
        Uri u = i != null ? i.getData() : null;
        String base = "https://" + Pacote.SITE + "/?appv=" + versaoNome();
        if (u != null && Pacote.SITE.equals(u.getHost())) {
            Uri.Builder b = u.buildUpon().scheme("https");
            if (u.getQueryParameter("appv") == null) b.appendQueryParameter("appv", versaoNome());
            return b.build().toString();
        }
        return base;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (web != null && i != null && i.getData() != null) web.loadUrl(endereco(i));
    }

    private void criarWeb() {
        try {
            if (getResources().getBoolean(R.bool.depurar)) WebView.setWebContentsDebuggingEnabled(true);
            web = new WebView(this);
        } catch (Throwable e) {
            // aparelho sem o "Android System WebView" (ou desativado)
            TextView t = new TextView(this);
            t.setText("Este aparelho precisa do \"Android System WebView\" atualizado para abrir o Pradaria.\n\nAtualize pela Play Store e abra de novo.");
            t.setTextSize(22);
            t.setTextColor(Color.WHITE);
            t.setBackgroundColor(Color.parseColor("#1F4F7A"));
            t.setPadding(60, 60, 60, 60);
            raiz.addView(t, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            return;
        }
        // transparente até o jogo desenhar: aparece o fundo de abertura (céu + desenho)
        web.setBackgroundColor(Color.TRANSPARENT);
        raiz.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE); // os arquivos já estão no aparelho
        s.setUserAgentString(s.getUserAgentString() + " PradariaApp/" + versaoNome());

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        // segurar o dedo é quebrar bloco: sem menu de copiar, sem lupa, sem vibrar
        web.setOnLongClickListener(v -> true);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);

        web.addJavascriptInterface(new PonteApp(), "PradariaApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest pedido) {
                return pacote.responder(pedido.getUrl(), pedido.getMethod());
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView v, String url) {
                return pacote.responder(Uri.parse(url), "GET");
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
                return abrirFora(pedido.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return abrirFora(Uri.parse(url));
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detalhe) {
                // o jogo derrubou o WebView (pouca memória): recria e abre de novo
                raiz.removeView(web);
                web.destroy();
                web = null;
                criarWeb();
                if (web != null) web.loadUrl(endereco(null));
                return true;
            }
        });

        // o service worker do site não é usado no app, mas se aparecer também pega os arquivos daqui
        if (Build.VERSION.SDK_INT >= 24) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest pedido) {
                    return pacote.responder(pedido.getUrl(), pedido.getMethod());
                }
            });
        }

        web.setWebChromeClient(new WebChromeClient() {
            // o app já é tela cheia
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                cb.onCustomViewHidden();
            }

            // chat de voz: o microfone do site vira o pedido de microfone do Android
            @Override
            public void onPermissionRequest(PermissionRequest p) {
                runOnUiThread(() -> {
                    boolean querMic = false;
                    for (String r : p.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) querMic = true;
                    if (!querMic || !Pacote.SITE.equals(p.getOrigin().getHost())) { p.deny(); return; }
                    if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        p.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        if (pedidoMicrofone != null) pedidoMicrofone.deny();
                        pedidoMicrofone = p;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PEDIDO_MICROFONE);
                    }
                });
            }

            // "Abrir arquivo do mundo"
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (escolhaArquivo != null) escolhaArquivo.onReceiveValue(null);
                escolhaArquivo = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Escolha o arquivo do mundo"), PEDIDO_ARQUIVO);
                } catch (ActivityNotFoundException e) {
                    escolhaArquivo = null;
                    return false;
                }
                return true;
            }
        });

        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();
    }

    /** endereço de fora do jogo (link de rede social, loja...): abre no navegador do aparelho */
    private boolean abrirFora(Uri u) {
        if (u == null) return true;
        if (Pacote.SITE.equals(u.getHost()) && "https".equals(u.getScheme())) return false;
        if ("about".equals(u.getScheme()) || "blob".equals(u.getScheme()) || "data".equals(u.getScheme())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception e) {
            // nenhum app abre esse endereço
        }
        return true;
    }

    /** o que o jogo pode pedir ao app (window.PradariaApp) */
    private class PonteApp {
        /** "Baixar arquivo do mundo": o Android pergunta onde guardar */
        @JavascriptInterface
        public void salvarArquivo(String nome, String texto) {
            runOnUiThread(() -> {
                textoParaSalvar = texto;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE, nome);
                try {
                    startActivityForResult(i, PEDIDO_SALVAR);
                } catch (ActivityNotFoundException e) {
                    textoParaSalvar = null;
                    avisoNoJogo("Este aparelho não tem onde guardar arquivos.");
                }
            });
        }

        @JavascriptInterface
        public String versao() {
            return versaoNome();
        }

        @JavascriptInterface
        public int versaoJogo() {
            return pacote.numeroAtual();
        }
    }

    private void avisoNoJogo(String txt) {
        if (web == null) return;
        String js = "(function(t){if(window.pradariaAviso)pradariaAviso(t);})(" + org.json.JSONObject.quote(txt) + ")";
        web.evaluateJavascript(js, null);
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        super.onActivityResult(pedido, resultado, dados);
        if (pedido == PEDIDO_ARQUIVO) {
            if (escolhaArquivo == null) return;
            Uri u = resultado == RESULT_OK && dados != null ? dados.getData() : null;
            escolhaArquivo.onReceiveValue(u != null ? new Uri[]{u} : null);
            escolhaArquivo = null;
        } else if (pedido == PEDIDO_SALVAR) {
            String texto = textoParaSalvar;
            textoParaSalvar = null;
            if (resultado != RESULT_OK || dados == null || dados.getData() == null || texto == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(dados.getData())) {
                if (out == null) throw new java.io.IOException("sem arquivo");
                out.write(texto.getBytes(StandardCharsets.UTF_8));
                avisoNoJogo("Arquivo do mundo guardado!");
            } catch (Exception e) {
                avisoNoJogo("Não deu para guardar o arquivo.");
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] perms, int[] res) {
        super.onRequestPermissionsResult(pedido, perms, res);
        if (pedido != PEDIDO_MICROFONE || pedidoMicrofone == null) return;
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) {
            pedidoMicrofone.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            pedidoMicrofone.deny();
        }
        pedidoMicrofone = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        // o jogo decide: pausa, fecha a janela de cima ou volta de tela; na tela inicial, pergunta se quer sair
        web.evaluateJavascript("(function(){try{return !!(window.pradariaVoltar&&window.pradariaVoltar());}catch(e){return false;}})()", r -> {
            if ("true".equals(r)) return;
            if (web != null && web.canGoBack()) web.goBack();
            else perguntarSair();
        });
    }

    private void perguntarSair() {
        new AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_LIGHT)
                .setTitle("Sair do Pradaria?")
                .setPositiveButton("Sair", (d, q) -> finish())
                .setNegativeButton("Continuar", (d, q) -> d.dismiss())
                .setOnDismissListener(d -> telaCheia())
                .show();
    }

    private boolean temInternet() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            @SuppressWarnings("deprecation") NetworkInfo n = cm != null ? cm.getActiveNetworkInfo() : null;
            return n != null && n.isConnected();
        } catch (Exception e) {
            return true;
        }
    }

    private int versaoCodigo() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 1;
        }
    }

    private String versaoNome() {
        try {
            String v = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            return v != null ? v : "1.0";
        } catch (Exception e) {
            return "1.0";
        }
    }

    @SuppressWarnings("deprecation")
    private void telaCheia() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean foco) {
        super.onWindowFocusChanged(foco);
        if (foco) telaCheia();
    }

    @Override
    protected void onSaveInstanceState(Bundle fora) {
        super.onSaveInstanceState(fora);
        if (web != null) web.saveState(fora);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        telaCheia();
        if (pacote != null && temInternet()) pacote.conferirAtualizacao();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            raiz.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
