import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { STATIC_SEO_COLUMNS } from './staticSeoColumns';

const colors = {
  primary: '#526b5d',
  textSub: '#8b9690',
  border: '#e4e7e5',
};

const getCategoryColor = (category) => {
  if (!category) return '#3b82f6';
  if (category.includes('基礎') || category.includes('用語')) return '#f59e0b';
  if (category.includes('農業') || category.includes('林業') || category.includes('水産')) return '#10b981';
  if (category.includes('IT') || category.includes('デジタル')) return '#0ea5e9';
  if (category.includes('設備') || category.includes('投資')) return '#8b5cf6';
  if (category.includes('販路') || category.includes('売上')) return '#f43f5e';
  if (category.includes('創業') || category.includes('起業')) return '#14b8a6';
  if (category.includes('承継') || category.includes('人材')) return '#64748b';
  return '#3b82f6';
};

const formatDate = (value) => {
  if (!value) return '';

  const dateObj = new Date(value);

  if (Number.isNaN(dateObj.getTime())) {
    return '';
  }

  return `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;
};

const getColumnTimestamp = (column) => {
  const dateObj = new Date(column?.published_at || column?.created_at || 0);
  return Number.isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
};

const mergeAndSortColumns = (columns = []) => {
  const bySlug = new Map();

  [...columns, ...STATIC_SEO_COLUMNS].forEach((column) => {
    if (!column?.slug) return;
    if (!bySlug.has(column.slug)) bySlug.set(column.slug, column);
  });

  return [...bySlug.values()].sort(
    (a, b) => getColumnTimestamp(b) - getColumnTimestamp(a)
  );
};

export default function PublicColumns() {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchColumns = async () => {
      if (!supabase) {
        if (!cancelled) {
          setColumns(STATIC_SEO_COLUMNS);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('columns')
          .select('id, title, slug, thumbnail_url, published_at, created_at, category')
          .eq('is_published', true)
          .not('slug', 'is', null)
          .neq('slug', '')
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('公開コラム取得エラー:', error);
        }

        if (!cancelled) {
          setColumns(mergeAndSortColumns(data || []));
          setLoading(false);
        }
      } catch (err) {
        console.error('公開コラム取得エラー:', err);

        if (!cancelled) {
          setColumns(STATIC_SEO_COLUMNS);
          setLoading(false);
        }
      }
    };

    fetchColumns();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '80px',
          color: colors.textSub,
        }}
      >
        ⏳ コラムを読み込んでいます...
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1000px',
        width: '100%',
        boxSizing: 'border-box',
        margin: '0 auto',
        padding: '40px 24px 80px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: '48px',
        }}
      >
        <h2
          style={{
            fontSize: '28px',
            color: '#111827',
            marginBottom: '16px',
            fontWeight: '800',
          }}
        >
          📘 お役立ちコラム
        </h2>

        <p
          style={{
            color: colors.textSub,
            fontSize: '15px',
            lineHeight: '1.7',
          }}
        >
          愛媛県の補助金・助成金に関する最新情報や、知っておきたい基礎知識を解説します。
        </p>
      </div>

      {columns.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            backgroundColor: 'white',
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            color: colors.textSub,
          }}
        >
          現在、公開中のコラムはありません。
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
            gap: '24px',
          }}
        >
          {columns.map((col) => {
            const dateStr = formatDate(col.published_at || col.created_at);
            const tagColor = getCategoryColor(col.category);

            return (
              <Link
                key={col.id}
                to={`/column/${col.slug}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  border: `1px solid ${colors.border}`,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  minWidth: 0,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                }}
              >
                <div
                  style={{
                    height: '180px',
                    backgroundColor: '#f1f5f9',
                    position: 'relative',
                  }}
                >
                  {col.thumbnail_url ? (
                    <img
                      src={col.thumbnail_url}
                      alt={col.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#cbd5e1',
                        fontSize: '40px',
                      }}
                    >
                      📄
                    </div>
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: tagColor,
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        lineHeight: '1.4',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        display: 'inline-block',
                        maxWidth: 'calc(100vw - 80px)',
                      }}
                    >
                      {col.category || 'コラム'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    padding: '20px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}
                >
                  {dateStr && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: colors.textSub,
                        marginBottom: '8px',
                        fontWeight: 'bold',
                      }}
                    >
                      {dateStr}
                    </div>
                  )}

                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '16px',
                      color: '#111827',
                      lineHeight: '1.5',
                      fontWeight: 'bold',
                    }}
                  >
                    {col.title || '無題のコラム'}
                  </h3>

                  <div
                    style={{
                      marginTop: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      color: colors.primary,
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                  >
                    記事を読む <span style={{ marginLeft: '4px' }}>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
