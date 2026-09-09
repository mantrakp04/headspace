import Cocoa
import WebKit
import Network
import Security
import Sparkle

let localOrigin = "http://127.0.0.1:4382"

final class SkinWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class LocalServer {
    private var listener: NWListener?
    let root: URL
    var callback: ((URL) -> Void)?
    init(root: URL) { self.root = root }
    func start(ready: @escaping (Error?) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 4382)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        listener.stateUpdateHandler = { state in
            switch state { case .ready: DispatchQueue.main.async { ready(nil) }; case .failed(let error): DispatchQueue.main.async { ready(error) }; default: break }
        }
        listener.newConnectionHandler = { [weak self] connection in
            connection.start(queue: .global(qos: .userInitiated))
            self?.receive(connection, Data())
        }
        listener.start(queue: .global(qos: .userInitiated))
    }
    private func receive(_ connection: NWConnection, _ prior: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, complete, error in
            guard let self else { connection.cancel(); return }
            var combined = prior; if let data { combined.append(data) }
            guard combined.count < 32768 else { connection.cancel(); return }
            if let header = String(data: combined, encoding: .utf8), header.contains("\r\n\r\n") { self.respond(connection, header) }
            else if error != nil || complete { connection.cancel() }
            else { self.receive(connection, combined) }
        }
    }
    private func respond(_ connection: NWConnection, _ header: String) {
        let lines = header.components(separatedBy: "\r\n")
        let request = (lines.first ?? "").split(separator: " ")
        guard request.count >= 2, request[0] == "GET", let host = lines.first(where: { $0.lowercased().hasPrefix("host:") }), host.lowercased() == "host: 127.0.0.1:4382", let url = URL(string: localOrigin + String(request[1])), url.host == "127.0.0.1" else { send(connection, 400, "text/plain", Data("Bad request".utf8)); return }
        if url.path == "/callback" {
            guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false), components.queryItems?.contains(where: { $0.name == "code" || $0.name == "error" }) == true else { send(connection, 400, "text/plain", Data("Missing authorization response".utf8)); return }
            DispatchQueue.main.async { self.callback?(url) }
            send(connection, 200, "text/html; charset=utf-8", Data("<!doctype html><html><head><title>Headspace connected</title></head><body style='background:#161616;color:#adff29;font:16px Verdana;padding:60px'><h1>Back to Headspace.</h1><p>Spotify returned your sign-in. Headspace will finish connecting.</p><p>You can close this tab.</p></body></html>".utf8)); return
        }
        let relative = url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let path = root.appendingPathComponent(relative).standardizedFileURL
        guard path.path.hasPrefix(root.standardizedFileURL.path + "/"), let data = try? Data(contentsOf: path), data.count < 20_000_000 else { send(connection, 404, "text/plain", Data("Not found".utf8)); return }
        let mime = ["html":"text/html; charset=utf-8", "js":"application/javascript", "css":"text/css", "png":"image/png", "json":"application/json", "svg":"image/svg+xml", "woff2":"font/woff2"][path.pathExtension] ?? "application/octet-stream"
        send(connection, 200, mime, data)
    }
    private func send(_ connection: NWConnection, _ status: Int, _ mime: String, _ body: Data) {
        let headers = "HTTP/1.1 \(status) \(status == 200 ? "OK" : "Error")\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'self'; script-src 'self' https://sdk.scdn.co; frame-src https://sdk.scdn.co; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline'; img-src 'self' https://i.scdn.co https://mosaic.scdn.co https://image-cdn-ak.spotifycdn.com https://image-cdn-fa.spotifycdn.com https://image-cdn-ak.spotifycdn.com data:; connect-src 'self' https://api.spotify.com https://accounts.spotify.com; frame-ancestors 'none'; base-uri 'none'\r\nConnection: close\r\n\r\n"
        var output = Data(headers.utf8); output.append(body)
        connection.send(content: output, completion: .contentProcessed { _ in connection.cancel() })
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSMenuItemValidation {
    var window: SkinWindow!
    var webView: WKWebView!
    var server: LocalServer!
    var pendingAuth: URL?
    let keychainService = "local.headspace.spotify"
    private var updaterController: SPUStandardUpdaterController!
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        updaterController = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
        makeMenu()
        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = "Version/26.0 Safari/605.1.15"
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "headspace")
        let bridge = """
        (()=>{let sequence=0;const pending=new Map();window.__headspaceReply=(reply)=>{const p=pending.get(reply.id);if(!p)return;pending.delete(reply.id);reply.error?p.reject(new Error(reply.error)):p.resolve(reply.value);};window.headspaceNative={request:(method,args={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});window.webkit.messageHandlers.headspace.postMessage({id,method,args});}),openAuth:async(url)=>window.headspaceNative.request('openAuth',{url})};})();
        """
        config.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = self
        window = SkinWindow(contentRect: NSRect(x: 0, y: 0, width: 1140, height: 591), styleMask: [.borderless, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Headspace"
        window.isOpaque = false; window.backgroundColor = .clear; window.hasShadow = false
        window.isMovableByWindowBackground = true
        window.contentView = webView
        window.center()
        guard let resource = Bundle.main.resourceURL else { return }
        server = LocalServer(root: resource.appendingPathComponent("web"))
        server.callback = { [weak self] url in
            guard let self else { return }
            self.pendingAuth = nil
            self.emit("headspace-oauth", url.absoluteString)
            self.window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        }
        do { try server.start { [weak self] error in
            guard let self else { return }
            if let error { let alert = NSAlert(); alert.messageText = "Headspace could not start"; alert.informativeText = "Port 4382 must be available. \(error.localizedDescription)"; alert.runModal(); NSApp.terminate(nil); return }
            self.webView.load(URLRequest(url: URL(string: localOrigin)!))
            self.window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        } } catch { NSApp.terminate(nil) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { window.makeKeyAndOrderFront(nil); return true }
    private func makeMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About Headspace", action: #selector(about), keyEquivalent: "")
        let checkForUpdates = appMenu.addItem(withTitle: "Check for Updates…", action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)), keyEquivalent: "")
        checkForUpdates.target = updaterController
        appMenu.addItem(withTitle: "Automatically Check for Updates", action: #selector(toggleUpdateChecks(_:)), keyEquivalent: "")
        appMenu.addItem(withTitle: "Automatically Download Updates", action: #selector(toggleUpdateDownloads(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Headspace", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); menu.addItem(editItem); let edit = NSMenu(title:"Edit"); editItem.submenu=edit
        edit.addItem(withTitle:"Copy",action:#selector(NSText.copy(_:)),keyEquivalent:"c")
        edit.addItem(withTitle:"Paste",action:#selector(NSText.paste(_:)),keyEquivalent:"v")
        edit.addItem(withTitle:"Select All",action:#selector(NSText.selectAll(_:)),keyEquivalent:"a")
        let viewItem = NSMenuItem(); menu.addItem(viewItem); let view = NSMenu(title:"View"); viewItem.submenu=view
        for (label, factor) in [("Original Size",1.0),("150%",1.5),("200%",2.0)] { let item=NSMenuItem(title:label,action:#selector(resize(_:)),keyEquivalent:"");item.representedObject=factor;view.addItem(item) }
        view.addItem(.separator())
        view.addItem(withTitle:"Always on Top",action:#selector(onTop(_:)),keyEquivalent:"t")
        NSApp.mainMenu = menu
    }
    @objc func about() { let alert=NSAlert();alert.messageText="Headspace";alert.informativeText="The original Windows Media Player Headspace skin, running locally on macOS with Spotify.\n\nOriginal skin © 2000 Microsoft Corporation.\nSpotify supplies the music.\n\nEQ sliders control the decorative visualizer; The visualization is decorative.";alert.runModal() }
    @objc func toggleUpdateChecks(_ sender: NSMenuItem) {
        updaterController.updater.automaticallyChecksForUpdates.toggle()
    }
    @objc func toggleUpdateDownloads(_ sender: NSMenuItem) {
        updaterController.updater.automaticallyDownloadsUpdates.toggle()
    }
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(toggleUpdateChecks(_:)) {
            menuItem.state = updaterController.updater.automaticallyChecksForUpdates ? .on : .off
        } else if menuItem.action == #selector(toggleUpdateDownloads(_:)) {
            menuItem.state = updaterController.updater.automaticallyDownloadsUpdates ? .on : .off
            return updaterController.updater.automaticallyChecksForUpdates
        }
        return true
    }
    @objc func resize(_ sender: NSMenuItem) { let scale=sender.representedObject as? Double ?? 1.5;window.setContentSize(NSSize(width:760*scale,height:394*scale));window.center() }
    @objc func onTop(_ sender: NSMenuItem) { window.level = window.level == .floating ? .normal : .floating;sender.state = window.level == .floating ? .on : .off }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy)->Void) {
        guard let url=navigationAction.request.url else { decisionHandler(.cancel);return }
        if navigationAction.targetFrame?.isMainFrame == false, url.scheme == "https", url.host == "sdk.scdn.co" { decisionHandler(.allow); return }
        if url.scheme == "http",url.host == "127.0.0.1",url.port == 4382 { decisionHandler(.allow);return }
        if ["accounts.spotify.com","developer.spotify.com","open.spotify.com"].contains(url.host ?? ""),url.scheme == "https" { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == "127.0.0.1", message.frameInfo.securityOrigin.port == 4382, let body=message.body as? [String:Any],let id=body["id"] as? Int,let method=body["method"] as? String else { return }
        let args=body["args"] as? [String:Any] ?? [:]
        switch method {
        case "minimize": window.miniaturize(nil);reply(id, true)
        case "close": NSApp.terminate(nil)
        case "drag": if let event=NSApp.currentEvent { window.performDrag(with:event) };reply(id,true)
        case "resize": let scale=min(2,max(1,args["scale"] as? Double ?? 1.5));window.setContentSize(NSSize(width:760*scale,height:394*scale));reply(id,true)
        case "openAuth":
            guard let raw=args["url"] as? String,let url=URL(string:raw),url.scheme == "https",url.host == "accounts.spotify.com",url.path == "/authorize" else { reply(id,nil,"Invalid authorization URL");return }
            pendingAuth=url
            NSWorkspace.shared.open(url);reply(id,true)
        case "authURL": reply(id,pendingAuth?.absoluteString ?? "")
        case "loadSession": reply(id,loadSession())
        case "saveSession":
            guard let value=args["value"] as? String,value.count < 16000 else {reply(id,nil,"Invalid session");return}
            do {try saveSession(value);reply(id,true)} catch {reply(id,nil,error.localizedDescription)}
        case "clearSession": SecItemDelete([kSecClass:kSecClassGenericPassword,kSecAttrService:keychainService,kSecAttrAccount:"spotify"] as CFDictionary);reply(id,true)
        default: reply(id,nil,"Unknown command")
        }
    }
    private func reply(_ id:Int,_ value:Any?,_ error:String?=nil) {
        var payload:[String:Any] = ["id":id,"value":value ?? NSNull()];if let error {payload["error"]=error}
        guard let data=try? JSONSerialization.data(withJSONObject:payload),let json=String(data:data,encoding:.utf8) else{return}
        DispatchQueue.main.async { self.webView.evaluateJavaScript("window.__headspaceReply(\(json))",completionHandler:nil) }
    }
    private func emit(_ name:String,_ value:String) { guard let data=try? JSONSerialization.data(withJSONObject:["name":name,"value":value]),let json=String(data:data,encoding:.utf8) else{return};webView.evaluateJavaScript("(()=>{const e=\(json);window.dispatchEvent(new CustomEvent(e.name,{detail:e.value}));})()",completionHandler:nil) }
    private func loadSession()->String {
        let query:[CFString:Any]=[kSecClass:kSecClassGenericPassword,kSecAttrService:keychainService,kSecAttrAccount:"spotify",kSecReturnData:true,kSecMatchLimit:kSecMatchLimitOne]
        var result:CFTypeRef?;guard SecItemCopyMatching(query as CFDictionary,&result) == errSecSuccess,let data=result as? Data else{return ""};return String(data:data,encoding:.utf8) ?? ""
    }
    private func saveSession(_ value:String)throws {
        let query:[CFString:Any]=[kSecClass:kSecClassGenericPassword,kSecAttrService:keychainService,kSecAttrAccount:"spotify"]
        let attributes:[CFString:Any]=[kSecValueData:Data(value.utf8),kSecAttrAccessible:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status=SecItemUpdate(query as CFDictionary,attributes as CFDictionary)
        if status == errSecItemNotFound {var item=query;attributes.forEach{item[$0.key]=$0.value};let added=SecItemAdd(item as CFDictionary,nil);if added != errSecSuccess{throw NSError(domain:NSOSStatusErrorDomain,code:Int(added))}}
        else if status != errSecSuccess {throw NSError(domain:NSOSStatusErrorDomain,code:Int(status))}
    }
}
let app=NSApplication.shared
let delegate=AppDelegate()
app.delegate=delegate
app.run()
