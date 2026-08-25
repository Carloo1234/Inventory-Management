import { Button } from "./components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "./components/ui/card";

function App() {
    return (
        <>
            <span className="text-amber-500 font-bold bg-blue-800">Testing tailwind</span>
            <Card className="w-96">
                <CardHeader>
                    <CardTitle>Total sale value.</CardTitle>
                    <CardDescription>You can select one of the following time periods.</CardDescription>
                    {/* <CardAction>Card Action</CardAction> */}
                </CardHeader>
                <CardContent>
                    <p>You've made $50,000 the past month.</p>
                </CardContent>
                <CardFooter className="flex justify justify-end gap-2">
                    <Button variant="outline">Cancel</Button>
                    <Button variant="default">Continue</Button>
                </CardFooter>
            </Card>
        </>
    );
}

export default App;
