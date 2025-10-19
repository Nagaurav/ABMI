import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ClockIcon,
  StarIcon,
} from '@heroicons/react/24/outline';


export default function Dashboard() {
  const navigate = useNavigate();
  const { userData, isLoading, error } = useDashboard();

  const statsItems = userData ? [
    {
      name: 'Interviews Completed',
      value: userData.interviewsCompleted,
      icon: ChartBarIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Average Score',
      value: `${userData.averageScore}%`,
      icon: StarIcon,
      color: 'bg-yellow-500',
    },
    {
      name: 'Key Improvement',
      value: userData.keyImprovementArea,
      icon: ClockIcon,
      color: 'bg-green-500',
    },
  ] : [];


  const handleStartInterview = () => {
    navigate('/interview');
  };

  const handleViewAnalysis = () => {
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-red-500 text-center">
            <p className="text-lg font-semibold">Error loading dashboard</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-100">
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-gray-100 mb-8">Welcome back, {userData?.name}!</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {statsItems.map((item) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900/60 border border-gray-700 p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <item.icon
                      className={`h-6 w-6 ${item.color} text-white rounded-md p-1`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-300 truncate">
                        {item.name}
                      </dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-100">
                          {item.value}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-900/60 border border-gray-700 p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-[1.02]">
              <h2 className="text-xl font-bold text-gray-100 mb-4">Quick Actions</h2>
              <div className="space-y-4">
                <button
                  onClick={handleStartInterview}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-[1.02]"
                >
                  Start New Interview
                </button>
                <button
                  onClick={handleViewAnalysis}
                  className="w-full bg-transparent text-indigo-400 py-3 px-4 rounded-md border border-indigo-600 hover:bg-indigo-950/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-[1.02]"
                >
                  View Analysis
                </button>
                <button
                  onClick={handleViewRecordings}
                  className="w-full bg-transparent text-indigo-400 py-3 px-4 rounded-md border border-indigo-600 hover:bg-indigo-950/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-[1.02]"
                >
                  View Recordings
                </button>
              </div>
            </div>

            <div className="bg-gray-900/60 border border-gray-700 p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-[1.02]">
              <h2 className="text-xl font-bold text-gray-100 mb-4">Performance History</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userData?.performanceHistory || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#E5E7EB' }} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#4F46E5"
                      fill="#818CF8"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Interview History Section */}
          {userData && userData.interviewHistory.length > 0 && (
            <div className="bg-gray-900/60 border border-gray-700 p-6 rounded-2xl shadow-xl">
              <h2 className="text-2xl font-semibold text-gray-100 mb-4">Recent Interviews</h2>
              <div className="space-y-3">
                {userData.interviewHistory.map((session) => (
                  <div
                    key={session.interview_session_id}
                    className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-indigo-500 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-gray-300 text-sm">
                        {new Date(session.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Duration: {Math.floor(session.duration / 60)} min {session.duration % 60} sec
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-indigo-400">{session.score}%</p>
                        <p className="text-xs text-gray-500 capitalize">{session.status}</p>
                      </div>
                      <button
                        onClick={() => navigate(`/analysis/${session.interview_session_id}`)}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        View Analysis
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}