import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-300">Last updated: October 1, 2025</p>
          
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
            <p className="text-gray-300">
              By accessing or using our services, you agree to be bound by these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. User Responsibilities</h2>
            <p className="text-gray-300">
              You are responsible for maintaining the confidentiality of your account and password.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Service Modifications</h2>
            <p className="text-gray-300">
              We reserve the right to modify or discontinue the service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Contact Us</h2>
            <p className="text-gray-300">
              If you have any questions about these Terms, please contact us at support@example.com
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
