import { useState, useEffect, useCallback } from 'react';
import { Book } from './books';
import { supabase } from './supabase';

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchBooks = useCallback(async () => {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch books:', error);
      return;
    }

    const mapped: Book[] = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      genre: row.genre,
      content: row.content,
      videoUrl: row.video_url ?? undefined,
      createdAt: row.created_at,
    }));

    setBooks(mapped);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const saveBook = useCallback(async (book: Partial<Book> & { id?: string }) => {
    const row = {
      title: book.title,
      author: book.author,
      genre: book.genre,
      content: book.content,
      video_url: book.videoUrl ?? null,
    };

    if (book.id) {
      const { error } = await supabase
        .from('books')
        .update(row)
        .eq('id', book.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('books')
        .insert(row);
      if (error) throw error;
    }

    await fetchBooks();
  }, [fetchBooks]);

  const deleteBook = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchBooks();
  }, [fetchBooks]);

  return { books, isLoaded, saveBook, deleteBook, refetch: fetchBooks };
}
