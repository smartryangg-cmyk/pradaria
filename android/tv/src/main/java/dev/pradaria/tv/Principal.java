package dev.pradaria.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Pradaria TV: o jogo do site (versão da TV, /tv) num WebView em tela cheia.
 * O controle remoto chega no jogo como teclas (setas, OK = Enter, botões coloridos);
 * o Voltar vira a tecla "GoBack" que o tv.js já entende. Segurar o Voltar pergunta se quer sair.
 */
public class Principal extends Activity {
    private static final String SITE = "pradaria.pages.dev";
    private static final String SEM_INTERNET = "file:///android_asset/sem-internet.html";

    private FrameLayout raiz;
    private WebView web;
    private boolean semInternet = false;
    private boolean perguntouSair = false;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        raiz = new FrameLayout(this);
        raiz.setBackgroundColor(Color.parseColor("#8FD3FF"));
        setContentView(raiz);
        telaCheia();
        criarWeb();
        if (web == null) return;
        if (salvo == null || web.restoreState(salvo) == null) web.loadUrl(getString(R.string.endereco));
    }

    private void criarWeb() {
        try {
            if (getResources().getBoolean(R.bool.depurar)) WebView.setWebContentsDebuggingEnabled(true);
            web = new WebView(this);
        } catch (Throwable e) {
            // aparelho sem o "Android System WebView" (ou desativado)
            TextView t = new TextView(this);
            t.setText("Este aparelho precisa do \"Android System WebView\" atualizado para abrir o Pradaria.\n\nAtualize pela Play Store da TV e abra de novo.");
            t.setTextSize(24);
            t.setTextColor(Color.WHITE);
            t.setBackgroundColor(Color.parseColor("#1F4F7A"));
            t.setPadding(80, 80, 80, 80);
            raiz.addView(t, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            return;
        }
        web.setBackgroundColor(Color.parseColor("#8FD3FF"));
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
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // "Android TV" no user agent: o site reconhece a TV e liga o Modo TV
        s.setUserAgentString(s.getUserAgentString() + " Android TV PradariaTV/" + versao());

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
                return !permitido(pedido.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return !permitido(Uri.parse(url));
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest pedido, WebResourceError erro) {
                if (pedido.isForMainFrame()) mostrarSemInternet();
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView v, int codigo, String descricao, String url) {
                if (Build.VERSION.SDK_INT < 23) mostrarSemInternet();
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                semInternet = url != null && url.startsWith("file:");
                v.requestFocus();
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detalhe) {
                // o jogo travou o WebView (pouca memória): recria e abre de novo
                raiz.removeView(web);
                web.destroy();
                web = null;
                criarWeb();
                if (web != null) web.loadUrl(getString(R.string.endereco));
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // o app já é tela cheia: recusa o "tela cheia" do site para o jogo não sumir
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                cb.onCustomViewHidden();
            }
        });

        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();
    }

    private boolean permitido(Uri u) {
        if (u == null) return false;
        String esq = u.getScheme();
        return "https".equals(esq) || "http".equals(esq) || "about".equals(esq) || "file".equals(esq);
    }

    private void mostrarSemInternet() {
        if (web == null || semInternet) return;
        semInternet = true;
        web.loadUrl(SEM_INTERNET + "?volta=" + Uri.encode(getString(R.string.endereco)));
    }

    /** chamado pelo botão "Tentar de novo" da tela sem internet */
    void tentarDeNovo() {
        semInternet = false;
        if (web != null) web.loadUrl(getString(R.string.endereco));
    }

    private String versao() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1.0";
        }
    }

    private void telaCheia() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean foco) {
        super.onWindowFocusChanged(foco);
        if (foco) {
            telaCheia();
            if (web != null) web.requestFocus();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (k == KeyEvent.KEYCODE_BACK) {
            if (web == null) return super.dispatchKeyEvent(e);
            if (e.getAction() == KeyEvent.ACTION_DOWN) {
                if (e.getRepeatCount() == 0) {
                    perguntouSair = false;
                    if (semInternet) { finish(); return true; }
                    voltarNoJogo();
                } else if (!perguntouSair && ((e.getFlags() & KeyEvent.FLAG_LONG_PRESS) != 0 || e.getEventTime() - e.getDownTime() > 800)) {
                    perguntouSair = true;
                    perguntarSair();
                }
            }
            return true;
        }
        // tela sem internet: OK tenta de novo
        if (semInternet && e.getAction() == KeyEvent.ACTION_UP
                && (k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER || k == KeyEvent.KEYCODE_BUTTON_A)) {
            tentarDeNovo();
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    /** o Voltar do controle vira a tecla "GoBack" no site; o tv.js fecha a janela, pausa o jogo ou volta de tela */
    private void voltarNoJogo() {
        web.evaluateJavascript("(function(){var a=document.activeElement||document.body;"
                + "var o={key:'GoBack',code:'GoBack',bubbles:true,cancelable:true};"
                + "a.dispatchEvent(new KeyboardEvent('keydown',o));a.dispatchEvent(new KeyboardEvent('keyup',o));})()", null);
    }

    private void perguntarSair() {
        new AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle("Sair do Pradaria?")
                .setPositiveButton("Sair", (dlg, q) -> finish())
                .setNegativeButton("Continuar jogando", (dlg, q) -> dlg.dismiss())
                .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle fora) {
        super.onSaveInstanceState(fora);
        if (web != null && !semInternet) web.saveState(fora);
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
