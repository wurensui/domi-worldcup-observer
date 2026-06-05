package com.domi.worldcupobserver;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    private static final String CLIENT_URL = "https://your-domain.example/worldcup-board";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.rgb(17, 33, 22));
        }

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        ProgressBar progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        root.addView(progressBar, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3)
        ));
        setContentView(root);

        configureWebView(progressBar);
        if (isOnline()) {
            webView.loadUrl(CLIENT_URL);
        } else {
            showOfflinePage();
        }
    }

    private void configureWebView(ProgressBar progressBar) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    showOfflinePage();
                }
            }
        });
    }

    private boolean handleUrl(Uri uri) {
        if (uri == null) return false;
        if (isAllowedInApp(uri)) return false;
        startActivity(new Intent(Intent.ACTION_VIEW, uri));
        return true;
    }

    private boolean isAllowedInApp(Uri uri) {
        String host = uri.getHost();
        if (host == null) return false;
        return host.endsWith("tcloudbaseapp.com")
                || host.endsWith("service.tcloudbase.com")
                || host.equals("localhost")
                || host.equals("127.0.0.1")
                || host.startsWith("192.168.");
    }

    private boolean isOnline() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (manager == null) return true;
        NetworkInfo info = manager.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void showOfflinePage() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{margin:0;background:#f4efe4;color:#211d18;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}"
                + ".box{padding:28px;text-align:center}.title{font-size:22px;font-weight:700}.text{margin-top:12px;color:rgba(33,29,24,.62);line-height:1.6}"
                + "button{margin-top:22px;height:44px;border:0;background:#112116;color:white;padding:0 22px;font-size:15px}</style></head>"
                + "<body><div class='box'><div class='title'>网络连接不可用</div><div class='text'>请检查网络后重新打开。</div>"
                + "<button onclick=\"location.href='" + CLIENT_URL + "'\">重新进入</button></div></body></html>";
        webView.loadDataWithBaseURL(CLIENT_URL, html, "text/html", "UTF-8", null);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
