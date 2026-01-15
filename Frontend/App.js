import "./src/polyfills";

import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { ThemeProvider } from './src/context/ThemeContext';

import { tfliteService } from "@/services/moderation/tflite.service";
import {useEffect} from "react";

export default function App() {
    useEffect(() => {
        (async () => {
            await tfliteService.init();
            await tfliteService.warmup();
        })().catch(console.error);
    }, []);

    return (
        <ThemeProvider>
            <NavigationContainer>
                <AuthNavigator />
                <StatusBar style="light" />
            </NavigationContainer>
        </ThemeProvider>
    );
}

