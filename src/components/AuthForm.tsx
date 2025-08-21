import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFileSystemOperations } from '@/hooks/useFileSystemOperations';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';

export function AuthForm() {
  const [loginData, setLoginData] = useState({ user: '', pass: '' });
  const [registerData, setRegisterData] = useState({ user: '', pass: '', confirmPass: '' });
  const { loginUser, createUser, loading, error } = useFileSystemOperations();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginData.user && loginData.pass) {
      await loginUser(loginData.user, loginData.pass);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.user && registerData.pass && registerData.pass === registerData.confirmPass) {
      await createUser(registerData.user, registerData.pass); 
    }
  }; 

  return (
    <div className="min-h-screen flex flex-col gap-5 items-center justify-center bg-background p-4">
      <img src="icon.png" alt="Logo" className="w-20" />
      <Card className="w-full max-w-md"> 
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">WarpFS</CardTitle>
          <CardDescription>Access your file system (Save your password)</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="Enter your username"
                    value={loginData.user}
                    onChange={(e) => setLoginData(prev => ({ ...prev, user: e.target.value }))}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.pass}
                    onChange={(e) => setLoginData(prev => ({ ...prev, pass: e.target.value }))}
                    disabled={loading}
                    required
                  />
                </div>
                {error && (
                  <div className="text-destructive text-sm">{error}</div>
                )}
                <Button type="submit" className="w-full" disabled={loading}  
                  >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Username</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="Choose a username"
                    value={registerData.user}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, user: e.target.value }))}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Choose a password"
                    value={registerData.pass}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, pass: e.target.value }))}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={registerData.confirmPass}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPass: e.target.value }))}
                    disabled={loading}
                    required
                  />
                </div>
                {registerData.pass !== registerData.confirmPass && registerData.confirmPass && (
                  <div className="text-destructive text-sm">Passwords do not match</div>
                )}
                {error && (
                  <div className="text-destructive text-sm">{error}</div>
                )}
                <Button 
                  type="submit" 
                  className="w-full"  
                  disabled={loading || registerData.pass !== registerData.confirmPass}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}