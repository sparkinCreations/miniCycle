import UIKit
import Capacitor

/// UIScene lifecycle adoption (Oct 2026).
///
/// The iOS 27.1 SDK (Xcode 27.1) traps at launch in apps that still run the
/// AppDelegate-only lifecycle — `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`
/// → SIGTRAP inside `didCreateScene`, before any of our code runs — so every
/// build since that Xcode update crashed the moment the icon was tapped.
/// Info.plist's UIApplicationSceneManifest points the single window scene at
/// Main.storyboard (which hosts Capacitor's bridge view controller) and at this
/// class. With scenes, URL and Universal Link opens arrive here rather than on
/// AppDelegate, so they are forwarded to Capacitor's proxy exactly as
/// AppDelegate's handlers did (the App plugin's appUrlOpen depends on it).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }
        // The storyboard named in the scene configuration instantiates the
        // window and Capacitor's root view controller; nothing to build here.
        for context in connectionOptions.urlContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
        for activity in connectionOptions.userActivities {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
