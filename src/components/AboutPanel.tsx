import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open } from '@tauri-apps/plugin-shell';
import { Activity, ExternalLink, Globe, Info, RefreshCw } from 'lucide-react';
import PanelHeader from '@/components/PanelHeader';
import { useTauriWindow } from '@/hooks/useTauriWindow';
// Import project metadata directly from package.json (bundled at build time by Vite)
import pkg from '../../package.json';

/** Parses an npm author string ("Name <email>") into name and optional email. */
function parseAuthor(author: string): { name: string; email?: string } {
  const emailMatch = author.match(/<([^>]+)>/);
  const name = author.replace(/<[^>]*>/g, '').trim();
  return { name, email: emailMatch?.[1] };
}

export function AboutPanel() {
  const { hideWindow } = useTauriWindow();

  const handleOpenRepository = (e: React.MouseEvent) => {
    e.preventDefault();
    open('https://github.com/orrisroot/zabbix-gadget');
  };

  const handleCheckUpdate = async () => {
    try {
      const updateWin = await WebviewWindow.getByLabel('update');
      if (updateWin) {
        // Show the update window before hiding About to avoid leaving the user with nothing
        await updateWin.show();
        await updateWin.setFocus();
        await updateWin.emit('trigger-check');
        await hideWindow();
      }
    } catch (err) {
      console.error('Failed to open update window from About panel:', err);
    }
  };

  const author = parseAuthor(pkg.author);

  return (
    <div className="panel-wrapper">
      <PanelHeader title="About" icon={<Info size={15} className="icon-indigo" />} onClose={hideWindow} compact />

      <main className="about-main">
        <div className="about-header">
          <div className="about-icon-wrapper">
            <Activity size={24} className="text-indigo-500 dark:text-indigo-400" />
          </div>
          <h2 className="about-title">{pkg.name}</h2>
          <span className="about-version">v{pkg.version}</span>
        </div>

        <p className="about-description">{pkg.description}</p>

        <div className="about-info">
          <div className="about-info-row">
            <span className="about-label">Author</span>
            <span className="about-val">
              {author.name}
              {author.email && <> &#x3C;{author.email}&#x3E;</>}
            </span>
          </div>
          <div className="about-info-row">
            <span className="about-label">License</span>
            <span className="about-val">{pkg.license}</span>
          </div>
          <div className="about-info-row">
            <span className="about-label">Repository</span>
            <a href="https://github.com/orrisroot/zabbix-gadget" onClick={handleOpenRepository} className="about-link">
              <Globe size={13} />
              <span>GitHub Repository</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </main>

      <footer className="about-footer">
        <button type="button" onClick={hideWindow} className="about-btn-close">
          Close
        </button>
        <button type="button" onClick={handleCheckUpdate} className="about-btn-update">
          <RefreshCw size={13} />
          Check for Updates
        </button>
      </footer>
    </div>
  );
}

export default AboutPanel;
