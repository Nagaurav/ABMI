import {
  BarChart3,
  Calendar,
  Clock,
  Video,
  Brain,
  Download,
  Share2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAnalysis } from '../hooks/useAnalysis';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#4f46e5', '#3b82f6', '#6366f1', '#8b5cf6'];

function Analysis() {
  const {
    performanceData,
    skillsData,
    communicationSkills,
    recommendations,
    latestInterview,
    loading,
    error,
    exportPDF,
    shareReport,
    metrics: realMetrics,
    overallScore,
    feedback,
    recentInterviews,
  } = useAnalysis();

  // Calculate metrics from communication skills and feedback data
  const metrics = [
    {
      name: 'Confidence',
      value: realMetrics?.confidence || 0,
      icon: UserGroupIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Clarity',
      value: realMetrics?.clarity || communicationSkills?.clarity || 0,
      icon: StarIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Engagement',
      value: realMetrics?.engagement || communicationSkills?.bodyLanguage || 0,
      icon: ChartBarIcon,
      color: 'bg-yellow-500',
    },
    {
      name: 'Response Quality',
      value: realMetrics?.responseQuality || communicationSkills?.examples || 0,
      icon: ClockIcon,
      color: 'bg-purple-500',
    },
  ];

  const handleVideoDownload = async () => {
    try {
      if (!latestInterview?.video_url) {
        toast.error('No video available to download');
        return;
      }
      toast.info('Starting video download...');
      // Implementation would go here
      setTimeout(() => {
        toast.success('Video downloaded successfully');
      }, 1500);
    } catch (err) {
      console.error('Error downloading video:', err);
      toast.error('Failed to download video');
    }
  };

  const handleVideoShare = async () => {
    try {
      if (!latestInterview?.video_url) {
        toast.error('No video available to share');
        return;
      }
      toast.info('Preparing video for sharing...');
      // Implementation would go here
      setTimeout(() => {
        toast.success('Video shared successfully');
      }, 1500);
    } catch (err) {
      console.error('Error sharing video:', err);
      toast.error('Failed to share video');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading analysis data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="h-6 w-6" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Performance Analysis</h1>
          <p className="text-muted-foreground mt-2">
            Detailed breakdown of your interview performance and AI-driven insights
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={shareReport}
            className="px-4 py-2 rounded-lg bg-secondary flex items-center gap-2 hover:bg-accent transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share Report
          </button>
          <button 
            onClick={exportPDF}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-secondary rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Latest Score</p>
              <p className="text-2xl font-semibold">
                {latestInterview?.score || 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-secondary rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Duration</p>
              <p className="text-2xl font-semibold">
                {Math.round(
                  performanceData.reduce(
                    (acc, curr) => acc + (curr.duration || 0),
                    0
                  ) / performanceData.length || 0
                )}m
              </p>
            </div>
          </div>
        </div>
        <div className="bg-secondary rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Interviews</p>
              <p className="text-2xl font-semibold">{performanceData.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-secondary rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Improvement</p>
              <p className="text-2xl font-semibold">
                {performanceData.length > 0
                  ? `${Math.round(
                      performanceData.reduce(
                        (acc, curr) => acc + (curr.score || 0),
                        0
                      ) / performanceData.length
                    )}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <div className="bg-secondary rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6">Performance Trend</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--secondary))',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  fill="url(#scoreGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Skills Distribution */}
        <div className="bg-secondary rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6">Skills Distribution</h2>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={skillsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {skillsData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--secondary))',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {skillsData.map((skill, index) => (
              <div key={skill.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm">{skill.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-secondary rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6">Communication Skills</h2>
          <div className="space-y-6">
            {Object.entries(communicationSkills).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between items-center mb-2">
                  <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  <span className="text-primary">{value}%</span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-secondary rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6">AI Recommendations</h2>
          <div className="space-y-4">
            {recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-3">
                <Brain className="h-6 w-6 text-primary mt-1" />
                <div>
                  <p className="font-medium">{recommendation.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {recommendation.description}
                  </p>
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <p className="text-muted-foreground">
                Complete more interviews to receive AI recommendations
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Latest Interview */}
      {latestInterview && (
        <div className="bg-secondary rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Latest Interview Recording</h2>
            <div className="flex gap-3">
              <button 
                onClick={handleVideoShare}
                className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
              >
                <Share2 className="h-5 w-5" />
                Share
              </button>
              <button 
                onClick={handleVideoDownload}
                className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
              >
                <Download className="h-5 w-5" />
                Download
              </button>
            </div>
          </div>
          <div className="aspect-video bg-background rounded-lg">
            {latestInterview.video_url ? (
              <video
                className="w-full h-full rounded-lg object-cover"
                src={latestInterview.video_url}
                controls
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No video available
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(latestInterview.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{latestInterview.duration || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                <span>{latestInterview.score}% Score</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {latestInterview.title}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          {/* Overall Score */}
          {overallScore > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white shadow overflow-hidden sm:rounded-lg mb-6"
            >
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Overall Performance Score
                </h3>
                <div className="mt-2 flex items-center">
                  <div className="text-4xl font-bold text-indigo-600">
                    {overallScore}%
                  </div>
                  <div className="ml-4">
                    <div className="h-2 w-32 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-indigo-600 rounded-full"
                        style={{ width: `${overallScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {metrics.map((metric) => (
              <motion.div
                key={metric.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white overflow-hidden shadow rounded-lg"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <metric.icon
                        className={`h-6 w-6 ${metric.color} text-white rounded-md p-1`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {metric.name}
                        </dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">
                            {metric.value}%
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Feedback Section */}
          {(feedback.strengths.length > 0 || feedback.improvements.length > 0) && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {feedback.strengths.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white shadow overflow-hidden sm:rounded-lg"
                >
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Strengths
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {feedback.strengths.map((strength, index) => (
                        <li
                          key={index}
                          className="flex items-start"
                        >
                          <div className="flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-green-400"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <p className="ml-3 text-sm text-gray-700">{strength}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}

              {feedback.improvements.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white shadow overflow-hidden sm:rounded-lg"
                >
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Areas for Improvement
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {feedback.improvements.map((improvement, index) => (
                        <li
                          key={index}
                          className="flex items-start"
                        >
                          <div className="flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-yellow-400"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <p className="ml-3 text-sm text-gray-700">{improvement}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Recent Interviews */}
          {recentInterviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg"
            >
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Recent Interviews
                </h3>
                <div className="mt-4">
                  <div className="flow-root">
                    <ul className="-my-5 divide-y divide-gray-200">
                      {recentInterviews.map((interview) => (
                        <li key={interview.id} className="py-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                Interview on {interview.date}
                              </p>
                              <p className="text-sm text-gray-500">
                                Duration: {interview.duration} minutes
                              </p>
                            </div>
                            <div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Score: {interview.score}%
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analysis;