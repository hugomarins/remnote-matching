import { usePlugin } from '@remnote/plugin-sdk';
import React, { useEffect, useState } from 'react';
import { ExerciseContext, readExerciseContext } from '../lib/context';

/**
 * The breadcrumb and the exercise rem, drawn as RemNote draws them above a
 * card (document icon, "›" between ancestors, the nearest one in bold; the
 * exercise as a bullet). An ancestor opens on click, as in Incremental
 * RemNote's reader.
 */
export function ExerciseHeader({ remId }: { remId: string }) {
  const plugin = usePlugin();
  const [context, setContext] = useState<ExerciseContext | null>(null);

  useEffect(() => {
    let alive = true;
    void readExerciseContext(plugin, remId).then((c) => alive && setContext(c));
    return () => {
      alive = false;
    };
  }, [remId]);

  if (!context) return null;
  const open = async (id: string) => {
    const rem = await plugin.rem.findOne(id);
    if (rem) await plugin.window.openRem(rem);
  };

  return (
    <div className="exercise-header">
      {context.crumbs.length > 0 && (
        <nav className="crumbs">
          <svg className="doc-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 1.5h5.2L12.5 4.8V14a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" />
            <path d="M9 1.5V5h3.5" />
          </svg>
          {context.crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              {i > 0 && <span className="sep">›</span>}
              <button
                className={`crumb ${i === context.crumbs.length - 1 ? 'last' : ''}`}
                title={crumb.text}
                onClick={() => open(crumb.id)}
              >
                {crumb.text}
              </button>
            </React.Fragment>
          ))}
        </nav>
      )}
      {context.titleHtml && (
        <div className="title">
          <span className="bullet">•</span>
          <span dangerouslySetInnerHTML={{ __html: context.titleHtml }} />
        </div>
      )}
    </div>
  );
}
