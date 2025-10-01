import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-300">Last updated: October 1, 2025</p>
          
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
            <p className="text-gray-300">
              We collect information that you provide directly to us, such as your name, email address, and any other information you choose to provide.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
            <p className="text-gray-300">
              We use the information we collect to provide, maintain, and improve our services, and to communicate with you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Information Sharing</h2>
            <p className="text-gray-300">
              We do not share your personal information with third parties except as described in this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Security</h2>
            <p className="text-gray-300">
              We take reasonable measures to help protect your personal information from loss, theft, misuse, and unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Contact Us</h2>
            <p className="text-gray-300">
              If you have any questions about this Privacy Policy, please contact us at privacy@example.com
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
