import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ChurchRecord from "./pages/ChurchRecord";
import TimelinePage from "./pages/Timeline";
import EvidencePage from "./pages/Evidence";
import SubmitPage from "./pages/Submit";
import PublicRecordsPage from "./pages/PublicRecords";
import ActorsPage from "./pages/Actors";
import ElectionPage from "./pages/Election";
import PatternsPage from "./pages/Patterns";
import PrivacyPage from "./pages/Privacy";
import AdminPage from "./pages/Admin";
import DocketGoblinBubble from "./components/DocketGoblinBubble";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/the-church-record" component={ChurchRecord} />
      <Route path="/timeline" component={TimelinePage} />
      <Route path="/evidence" component={EvidencePage} />
      <Route path="/evidence/:id" component={EvidencePage} />
      <Route path="/submit" component={SubmitPage} />
      <Route path="/public-records" component={PublicRecordsPage} />
      <Route path="/actors" component={ActorsPage} />
      <Route path="/actors/:slug" component={ActorsPage} />
      <Route path="/election" component={ElectionPage} />
      <Route path="/patterns" component={PatternsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/story/:id" component={AdminPage} />
      <Route path="/admin/document/:id" component={AdminPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <DocketGoblinBubble />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
