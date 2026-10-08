import { useState, useEffect, useRef } from "react";
import {
  AppState,
  View,
  useWindowDimensions,
  Platform,
  DeviceEventEmitter,
} from "react-native";

import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  NavigationContainer,
} from "@react-navigation/native";

import {
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";

import { Ionicons } from "@expo/vector-icons";

import { ThemeProvider, useTheme } from "./ThemeContext";

import LockScreen from "./LockScreen";
import TodayScreen from "./TodayScreen";
import ExpensesScreen from "./ExpensesScreen";
import StepsScreen from "./StepsScreen";
import CalendarScreen from "./CalendarScreen";
import NotesScreen from "./NotesScreen";
import SettingsScreen from "./SettingsScreen";
import FocusScreen from "./FocusScreen";
import MoodScreen from "./MoodScreen";
import TimelineScreen from "./TimelineScreen";
import ReviewScreen from "./ReviewScreen";
import GoalsScreen from "./GoalsScreen";
import InsightsScreen from "./InsightsScreen";
import MoreScreen from "./MoreScreen";
import PrivacyScreen from "./PrivacyScreen";
import Protected from "./Protected";

import AsyncStorage from "@react-native-async-storage/async-storage";

import AuthScreen from "./AuthScreen";
import {
  hasSession,
  getMe,
  logout,
  cloudPull,
} from "./api";

import { backgroundSync, createVaultAndSync } from "./sync";
import { hasLocalVault, getLocalRecoveryCode } from "./cryptoVault";
import DataRecoveryScreen from "./DataRecoveryScreen";
import { askStepPermission, startStepCounter, refreshSteps } from "./stepCounter";
import RecoveryCodeScreen from "./RecoveryCodeScreen";

const Tab = createBottomTabNavigator();
// Hidden tabs: no button and no empty space in the footer
const hiddenTab = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: "none" },
};

/* =========================================================
   PROTECTED TABS
   ========================================================= */

function MoneyTab() {
  return (
    <Protected
      setting="protectExpenses"
      title="Money"
    >
      <ExpensesScreen />
    </Protected>
  );
}

function TimelineTab() {
  return (
    <Protected
      setting="protectTimeline"
      title="Timeline"
    >
      <TimelineScreen />
    </Protected>
  );
}

/* =========================================================
   TAB ICONS
   ========================================================= */

const icons = {
  Today: ["sparkles", "sparkles-outline"],

  Expenses: ["wallet", "wallet-outline"],

  Timeline: ["git-branch", "git-branch-outline"],

  Review: ["bar-chart", "bar-chart-outline"],

  More: [
    "ellipsis-horizontal-circle",
    "ellipsis-horizontal-circle-outline",
  ],

  Steps: ["footsteps", "footsteps-outline"],

  Calendar: ["calendar", "calendar-outline"],

  Notes: ["document-text", "document-text-outline"],

  Settings: ["settings", "settings-outline"],

  Focus: ["checkmark-circle", "checkmark-circle-outline"],

  Mood: ["happy", "happy-outline"],

  Goals: ["flag", "flag-outline"],

  Insights: ["bulb", "bulb-outline"],

  Privacy: ["lock-closed", "lock-closed-outline"],
};

/* =========================================================
   BOTTOM TABS
   ========================================================= */

function Tabs() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Space under the tabs for the phone's gesture bar / buttons
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.tabActive,
          tabBarInactiveTintColor: theme.tabInactive,
          tabBarHideOnKeyboard: true,
          tabBarAllowFontScaling: false,

          // The footer bar: taller, with space above and below
          tabBarStyle: {
            height: 72 + bottomInset,
            paddingTop: 8,
            paddingBottom: bottomInset + 6,
            backgroundColor: theme.tabBar,
            borderTopColor: theme.cardBorder,
            borderTopWidth: theme.borderWidth,
          },

          // Each tab: no forced width, so labels are not cut off
          tabBarItemStyle: {
            paddingVertical: 2,
          },

          tabBarLabelStyle: {
            fontWeight: "600",
            fontSize: 11,
            fontFamily: theme.fontFamily,
            marginTop: 4,
          },

          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? icons[route.name][0] : icons[route.name][1]}
              size={24}
              color={color}
            />
          ),
        })}
      >
        {/* Main tabs (shown in the footer) */}
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen
          name="Expenses"
          component={MoneyTab}
          options={{ title: "Money", tabBarLabel: "Money" }}
        />
        <Tab.Screen name="Timeline" component={TimelineTab} />
        <Tab.Screen name="Review" component={ReviewScreen} />
        <Tab.Screen name="More" component={MoreScreen} />

        {/* Hidden tabs (opened from More) */}
        <Tab.Screen name="Steps" component={StepsScreen} options={hiddenTab} />
        <Tab.Screen name="Calendar" component={CalendarScreen} options={hiddenTab} />
        <Tab.Screen name="Notes" component={NotesScreen} options={hiddenTab} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={hiddenTab} />
        <Tab.Screen name="Focus" component={FocusScreen} options={hiddenTab} />
        <Tab.Screen name="Mood" component={MoodScreen} options={hiddenTab} />
        <Tab.Screen name="Goals" component={GoalsScreen} options={hiddenTab} />
        <Tab.Screen name="Insights" component={InsightsScreen} options={hiddenTab} />
        <Tab.Screen name="Privacy" component={PrivacyScreen} options={hiddenTab} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

/* =========================================================
   ROOT AUTH + APP LOCK
   ========================================================= */

function Root() {
  const [authState, setAuthState] =
    useState("checking");

  const [unlocked, setUnlocked] =
    useState(false);

  const leftAt = useRef(0);

  // The private-data key: "checking" -> "recover" | "showCode" -> "ready"
  const [vaultState, setVaultState] = useState("checking");
  const [recoveryCode, setRecoveryCode] = useState("");

  /* -------------------------------------------------------
     VERIFY LOGIN SESSION
  ------------------------------------------------------- */

  async function verifySession() {
    try {
      const sessionExists = await hasSession();

      if (!sessionExists) {
        setAuthState("signedOut");
        return;
      }

      await getMe();

      setAuthState("signedIn");
    } catch {
      await logout();

      setAuthState("signedOut");
    }
  }

  /* -------------------------------------------------------
     INITIAL SESSION CHECK
  ------------------------------------------------------- */

  useEffect(() => {
    verifySession();

    const subscription =
      DeviceEventEmitter.addListener(
        "lifetracker-logout",
        () => {
          setUnlocked(false);

          setVaultState("checking");

          setAuthState("signedOut");
        }
      );

    return () => {
      subscription.remove();
    };
  }, []);

  /* -------------------------------------------------------
     PRIVATE DATA KEY (runs once after sign-in and unlock)
     - new phone with cloud data  -> ask for the recovery code
     - new key                    -> show the recovery code once
  ------------------------------------------------------- */

  useEffect(() => {
    if (authState !== "signedIn" || !unlocked) {
      return;
    }

    async function checkVault() {
      try {
        if (!(await hasLocalVault())) {
          const remote = await cloudPull();

          if (remote.data) {
            // This phone has no key but the account has a backup
            setVaultState("recover");
            return;
          }

          // Brand new account: make the key and the first backup
          await createVaultAndSync();
        }

        // Show the recovery code one time, so it is never lost
        const seen = await AsyncStorage.getItem("recoveryCodeSeen");

        if (!seen) {
          const code = await getLocalRecoveryCode();

          if (code) {
            setRecoveryCode(code);
            setVaultState("showCode");
            return;
          }
        }

        setVaultState("ready");
      } catch {
        // Offline: use the app now, check again next time
        setVaultState("ready");
      }
    }

    checkVault();
  }, [authState, unlocked]);

  /* -------------------------------------------------------
     STEP COUNTER (all-day, even when the app is closed)
     Asks the phone for permission once, then starts the background reader.
  ------------------------------------------------------- */

  useEffect(() => {
    if (authState !== "signedIn" || vaultState !== "ready") {
      return;
    }

    async function startSteps() {
      const allowed = await askStepPermission();

      if (allowed) {
        await startStepCounter();
        await refreshSteps();
      }
    }

    startSteps();
  }, [authState, vaultState]);

  /* -------------------------------------------------------
     CLOUD SYNC
  ------------------------------------------------------- */

  useEffect(() => {
    if (authState !== "signedIn" || vaultState !== "ready") {
      return;
    }

    let cancelled = false;

    /*
     * Initial sync.
     */
    (async () => {
      try {
        await backgroundSync();
      } catch {
        // Offline mode is allowed.
      }
    })();

    /*
     * Periodic sync while the app is unlocked.
     */
    const timer = setInterval(
      async () => {
        if (!cancelled && unlocked) {
          try {
            await backgroundSync();
          } catch {
            // Keep app usable when offline.
          }
        }
      },
      15000
    );

    return () => {
      cancelled = true;

      clearInterval(timer);
    };
  }, [authState, unlocked, vaultState]);

  /* -------------------------------------------------------
     APP BACKGROUND / FOREGROUND
  ------------------------------------------------------- */

  useEffect(() => {
    if (authState !== "signedIn") {
      return;
    }

    const subscription =
      AppState.addEventListener(
        "change",
        async (state) => {
          /*
           * Remember when the app entered background.
           */
          if (state === "background") {
            leftAt.current = Date.now();
          }

          /*
           * When returning to the app:
           *
           * 1. Check auto-lock timeout.
           * 2. Sync latest cloud data.
           */
          if (
            state === "active" &&
            leftAt.current > 0
          ) {
            const secondsAway =
              (Date.now() - leftAt.current) /
              1000;

            leftAt.current = 0;

            // Bring in the steps counted while the app was closed
            refreshSteps();

            const saved =
              await AsyncStorage.getItem(
                "privacySettings"
              );

            let limit = 30;

            try {
              limit =
                Number(
                  JSON.parse(
                    saved || "{}"
                  ).autoLockSeconds
                ) || 30;
            } catch {
              limit = 30;
            }

            if (secondsAway > limit) {
              setUnlocked(false);
            }

            try {
              await backgroundSync();
            } catch {
              // Offline mode is allowed.
            }
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, [authState]);

  /* -------------------------------------------------------
     AUTH CHECK
  ------------------------------------------------------- */

  if (authState === "checking") {
    return (
      <View
        style={{
          flex: 1,
        }}
      />
    );
  }

  /* -------------------------------------------------------
     LOGIN
  ------------------------------------------------------- */

  if (authState === "signedOut") {
    return (
      <AuthScreen
        onAuthenticated={async () => {
          setAuthState("signedIn");
        }}
      />
    );
  }

  /* -------------------------------------------------------
     LOCAL APP LOCK
  ------------------------------------------------------- */

  if (!unlocked) {
    return (
      <LockScreen
        onUnlock={() => {
          setUnlocked(true);
        }}
      />
    );
  }

  /* -------------------------------------------------------
     PRIVATE DATA KEY SCREENS
  ------------------------------------------------------- */

  if (vaultState === "checking") {
    return <View style={{ flex: 1 }} />;
  }

  if (vaultState === "recover") {
    return (
      <DataRecoveryScreen
        onRecovered={async () => {
          await AsyncStorage.setItem("recoveryCodeSeen", "yes");
          setVaultState("ready");
        }}
      />
    );
  }

  if (vaultState === "showCode") {
    return (
      <RecoveryCodeScreen
        code={recoveryCode}
        onContinue={async () => {
          await AsyncStorage.setItem("recoveryCodeSeen", "yes");
          setVaultState("ready");
        }}
      />
    );
  }

  /* -------------------------------------------------------
     MAIN APP
  ------------------------------------------------------- */

  return <Tabs />;
}

/* =========================================================
   APP ROOT
   ========================================================= */

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}