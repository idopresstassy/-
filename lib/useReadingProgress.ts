import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export function useReadingProgress(bookId: string) {
  const { user } = useAuth();
  const [savedLineIndex, setSavedLineIndex] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoaded(true);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from('reading_progress')
        .select('line_index')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .single();

      if (data) {
        setSavedLineIndex(data.line_index);
      }
      setIsLoaded(true);
    };

    load();
  }, [user, bookId]);

  const saveProgress = useCallback(
    (lineIndex: number) => {
      if (!user) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);

      saveTimer.current = setTimeout(async () => {
        await supabase.from('reading_progress').upsert(
          {
            user_id: user.id,
            book_id: bookId,
            line_index: lineIndex,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,book_id' }
        );
      }, 2000);
    },
    [user, bookId]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { savedLineIndex, saveProgress, isProgressLoaded: isLoaded };
}
