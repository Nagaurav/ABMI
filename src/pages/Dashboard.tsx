import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ClockIcon,
  StarIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowTrendingUpIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';


// Custom tooltip for the performance chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Score: <span className="font-semibold">{payload[0].value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { userData, isLoading, error, refetch } = useDashboard();

  const statsItems = userData ? [
    {
      name: 'Interviews Completed',
      value: userData.interviews_completed ?? 0,
      icon: ChartBarIcon,
      color: 'bg-blue-500',
      description: 'Total interviews completed',
    },
    {
      name: 'Average Score',
      value: `${(userData.average_score ?? 0).toFixed(1)}%`,
      icon: StarIcon,
      color: 'bg-yellow-500',
      description: 'Your average performance score',
    },
    {
      name: 'Key Improvement',
      value: userData.latest_improvement_area || 'N/A',
      icon: ArrowTrendingUpIcon,
      color: 'bg-green-500',
      description: 'Focus area for improvement',
    },
  ] : [];

  const handleStartInterview = () => {
    navigate('/interview');
  };

  const handleViewAnalysis = (sessionId: string) => {
    navigate(`/analysis/${sessionId}`);
  };

  const handleRefresh = async () => {
    await refetch();
    navigate('/analysis');
  };

  const handleViewRecordings = () => {
    navigate('/recordings');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-foreground">Error Loading Dashboard</h2>
          <p className="mt-2 text-muted-foreground">
            {error}
          </p>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="mt-4"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {userData?.full_name || 'User'}!
            </h1>
            <p className="text-muted-foreground">
              Here's your interview preparation dashboard
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={handleStartInterview}
              className="gap-2"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              New Interview
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statsItems.map((stat, index) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.name}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                    <stat.icon className={`h-5 w-5 ${stat.color.replace('bg-', 'text-')}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>
              Your interview performance over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              {userData?.performance_history?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={userData.performance_history}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis 
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background p-3 border rounded-lg shadow-lg">
                              <p className="font-medium">{format(new Date(label), 'MMMM d, yyyy')}</p>
                              <p className="text-sm text-primary">
                                Score: <span className="font-semibold">{payload[0].value}%</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#4f46e5"
                      fillOpacity={1}
                      fill="url(#colorScore)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No performance data available. Complete an interview to see your progress.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Interviews */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Interviews</CardTitle>
            <CardDescription>
              Your most recent interview sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userData?.interview_history?.length ? (
              <div className="space-y-4">
                {userData.interview_history.map((interview) => (
                  <div 
                    key={interview.session_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <UserCircleIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          Interview on {format(new Date(interview.date), 'MMMM d, yyyy')}
                        </p>
                        <div className="flex items-center mt-1 space-x-2">
                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              interview.score >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                              interview.score >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 
                              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}
                          >
                            {interview.score}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewAnalysis(interview.session_id)}
                      className="gap-2"
                    >
                      View Analysis
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No interview history yet</p>
                <Button onClick={handleStartInterview}>
                  Start Your First Interview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}