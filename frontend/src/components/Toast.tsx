/** 하단 토스트 — 삭제처럼 되돌릴 수 있는 행동 뒤에 "되돌리기"를 4초간 보여준다 (확인창 대신 undo) */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, floating, motion, radius } from '@/theme';
import { T, useAnimValue, useReducedMotion } from './ui';

type Toast = { id: number; message: string; undo?: () => void };
const Ctx = createContext<(message: string, undo?: () => void) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p = useAnimValue(0);
  const reduced = useReducedMotion();
  const native = Platform.OS !== 'web';

  const hide = useCallback(() => {
    Animated.timing(p, { toValue: 0, duration: reduced ? 0 : motion.exit, easing: motion.easeOut, useNativeDriver: native }).start(
      () => setToast(null),
    );
  }, [p, reduced, native]);

  const show = useCallback(
    (message: string, undo?: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, undo });
      timer.current = setTimeout(hide, 4000);
    },
    [hide],
  );

  useEffect(() => {
    if (!toast) return;
    p.setValue(0);
    Animated.timing(p, { toValue: 1, duration: reduced ? 0 : motion.enter, easing: motion.easeOut, useNativeDriver: native }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <View pointerEvents="box-none" style={styles.layer}>
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              floating,
              { opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
            ]}
          >
            <T size={14} weight="600" color="#fff" style={{ flex: 1 }} numberOfLines={2}>
              {toast.message}
            </T>
            {toast.undo && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="되돌리기"
                hitSlop={8}
                style={({ pressed }) => [styles.undo, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  toast.undo?.();
                  if (timer.current) clearTimeout(timer.current);
                  hide();
                }}
              >
                <T size={14} weight="700" color="#9DB7FF">
                  되돌리기
                </T>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', paddingHorizontal: 16 },
  toast: {
    width: '100%',
    maxWidth: 408,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 52,
  },
  undo: { paddingHorizontal: 10, minHeight: 40, justifyContent: 'center' },
});
