/**
 * DBCreator App Shell
 * Obsidian Forge neomorphism design
 * Routes: /, /designer/:projectId, /tables/:projectId/:tableId, /forms/:projectId,
 *         /reports/:projectId, /menus/:projectId, /run/:projectId/:formId,
 *         /view/:projectId/:reportId
 */
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/NotFound';
import { Route, Switch } from 'wouter';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { DBProvider } from './contexts/DBContext';
import AppLayout from './components/AppLayout';
import Home from './pages/Home';
import DesignerPage from './pages/DesignerPage';
import TableDesignerPage from './pages/TableDesignerPage';
import FormsPage from './pages/FormsPage';
import ReportsPage from './pages/ReportsPage';
import MenusPage from './pages/MenusPage';
import FormRunnerPage from './pages/FormRunnerPage';
import ReportViewerPage from './pages/ReportViewerPage';
import RelationshipsPage from './pages/RelationshipsPage';
import AIChatPage from './pages/AIChatPage';
import AISettingsPage from './pages/AISettingsPage';
import ERDPage from './pages/ERDPage';
import PublisherPage from './pages/PublisherPage';
import TemplatesPage from './pages/TemplatesPage';
import HelpPage from './pages/HelpPage';
import StartupWalkthrough from './components/StartupWalkthrough';
import { WalkthroughProvider } from './contexts/WalkthroughContext';

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/designer/:projectId" component={DesignerPage} />
        <Route path="/tables/:projectId/:tableId" component={TableDesignerPage} />
        <Route path="/relationships/:projectId" component={RelationshipsPage} />
        <Route path="/forms/:projectId" component={FormsPage} />
        <Route path="/reports/:projectId" component={ReportsPage} />
        <Route path="/menus/:projectId" component={MenusPage} />
        <Route path="/run/:projectId/:formId" component={FormRunnerPage} />
        <Route path="/ai-chat" component={AIChatPage} />
        <Route path="/ai-settings" component={AISettingsPage} />
        <Route path="/erd/:projectId" component={ERDPage} />
        <Route path="/publish/:projectId" component={PublisherPage} />
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/help" component={HelpPage} />
        <Route path="/view/:projectId/:reportId" component={ReportViewerPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <WalkthroughProvider>
          <DBProvider>
            <TooltipProvider>
              <Toaster
                theme="dark"
                toastOptions={{
                  style: {
                    background: 'oklch(0.195 0.014 270)',
                    border: '1px solid oklch(1 0 0 / 0.07)',
                    color: 'oklch(0.92 0.008 270)',
                    boxShadow: '6px 6px 14px rgba(0,0,0,0.45), -3px -3px 8px rgba(255,255,255,0.04)',
                  },
                }}
              />
              <Router />
              <StartupWalkthrough />
            </TooltipProvider>
          </DBProvider>
        </WalkthroughProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
