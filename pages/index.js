import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import CircularProgress from "@mui/material/CircularProgress";
import { io } from "socket.io-client";

export default function Home() {
  const [userInput, setUserInput] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      message: "System:\n\n Hi there! How can I help?",
      type: "apiMessage",
    },
  ]);
  const [socket, setSocket] = useState(null);
  const [isConversationStarted, setIsConversationStarted] = useState(false);
  const [socketId, setSocketId] = useState("");
  const [alerted, setAlerted] = useState(false); // State to track if the user has been alerted

  const messageListRef = useRef(null);
  const textAreaRef = useRef(null);

  // Initialize socket
  useEffect(() => {
    const newSocket = io("http://localhost:8765", {
      reconnection: true,
      timeout: 60000, // 1mins
      reconnectionAttempts: 3,
    });

    newSocket.on("connect", () => {
      setSocketId(newSocket.id);
      console.log("Connected with ID:", newSocket.id);
      setAlerted(false); // Reset alerted state on successful connection
    });

    // Listen for disconnect event
    newSocket.on("disconnect", (reason) => {
      if (!alerted) {
        // MODIFIED: Check if the alert has been triggered already
        if (reason === "io server disconnect") {
          newSocket.connect();
        }
        alert(
          "Your session has ended. Please refresh the page to start a new chat."
        );
        setAlerted(true); // MODIFIED: Set the alert flag to prevent further alerts
        window.location.reload(); // Uncomment to refresh the page automatically
      }
    });

    // Listen for messages from socket
    newSocket.on("message", (message) => {
      console.log(message);
      const sender = formatString(message.sender);
      let formattedMessage = "";
      if (sender !== "User Proxy") {
        if ("content" in message) {
          const content = removeTrailingTerminate(message.content);
          formattedMessage = `${sender}:\n\n ${content}`;
          setMessages((prevMessages) => [
            ...prevMessages,
            { message: formattedMessage, type: "apiMessage" },
            // TODO: Handle messages
          ]);
        } else if ("suggested_function" in message) {
          const suggestedFunction = message.suggested_function;
          const functionName = formatString(suggestedFunction.name);

          // Use the sanitizeJSONString function to clean the input
          // const sanitizedArguments = sanitizeJSONString(
          //   suggestedFunction.arguments
          // );

          // const functionArguments = JSON.stringify(
          //   JSON.parse(suggestedFunction.arguments),
          //   null,
          //   2
          // );
          // formattedMessage = `${sender}:\n\nSuggested Function: ${functionName}\n\nArguments: ${functionArguments}`;
          formattedMessage = `${sender}:\n\nSuggested Function: ${functionName}`;
          setMessages((prevMessages) => [
            ...prevMessages,
            { message: formattedMessage, type: "apiMessage" },
            // TODO: Handle messages
          ]);
        }
      }
      // setMessages((prevMessages) => [
      //   ...prevMessages,
      //   { message: formattedMessage, type: "apiMessage" },
      //  // TODO: Handle messages
      // ]);
      //TODO: Wait for SYSTEM message to stop loading
      if (sender === "System") {
        setLoading(false);
      }
      // setLoading(false);
    });

    newSocket.on("connect_error", (err) => {
      handleError();
    });

    setSocket(newSocket);

    return () => {
      newSocket.off("disconnect");
      newSocket.disconnect();
    };
  }, [alerted]);

  // Auto scroll chat to bottom
  useEffect(() => {
    const messageList = messageListRef.current;
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages]);

  // Focus on text field on load
  useEffect(() => {
    textAreaRef.current.focus();
  }, []);

  // Handle errors
  const handleError = () => {
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        message:
          "System:\n\nOops! There seems to be an error. Please try again.",
        type: "apiMessage",
      },
    ]);
    setLoading(false);
    setUserInput("");
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if the current socket ID has changed due to a reconnection
    if (socket && socket.id !== socketId) {
      alert(
        "The connection was lost and a new session has started. Please resend your last message."
      );
      window.location.reload(); // Refresh the page to start a new session with a fresh socket connection
      return;
    }

    // if (userInput.trim() === "") {
    //   return;
    // }

    // Check for "exit" command from the user
    if (userInput.trim().toLowerCase() === "exit") {
      setLoading(false);
      setMessages((prevMessages) => [
        ...prevMessages,
        { message: `User:\n\n ${userInput}`, type: "userMessage" },
        { message: "System:\n\n Exiting conversation...", type: "apiMessage" },
      ]);
    } else if (userInput.trim() === "") {
      setLoading(true);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: `User:\n\n Using auto reply.`,
          type: "userMessage",
        },
      ]);
    } else {
      setLoading(true);
      setMessages((prevMessages) => [
        ...prevMessages,
        { message: `User:\n\n ${userInput}`, type: "userMessage" },
      ]);
    }

    // Send user question and history to API
    // const response = await fetch("/api/chat", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({ question: userInput, history: history }),
    // });

    // if (!response.ok) {
    //   handleError();
    //   return;
    // }
    if (socket) {
      const eventType = isConversationStarted
        ? "user_input_follow"
        : "user_input";
      socket.emit(eventType, {
        user_input: userInput,
      });
      setIsConversationStarted(true);
    } else {
      console.log("Socket not connected");
    }
    // Reset user input
    setUserInput("");
    // const data = await response.json();

    // if (data.result.error === "Unauthorized") {
    //   handleError();
    //   return;
    // }

    // setMessages((prevMessages) => [
    //   ...prevMessages,
    //   { message: data.result.success, type: "apiMessage" },
    // ]);
    // setLoading(false);
  };

  // Prevent blank submissions and allow for multiline input
  const handleEnter = (e) => {
    if (e.key === "Enter" && userInput) {
      if (!e.shiftKey && userInput) {
        handleSubmit(e);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  // Keep history in sync with messages
  useEffect(() => {
    if (messages.length >= 3) {
      setHistory([
        [
          messages[messages.length - 2].message,
          messages[messages.length - 1].message,
        ],
      ]);
    }
  }, [messages]);

  // Helper function to format string
  const formatString = (str) => {
    return (
      str
        // Replace underscores with spaces
        .replace(/_/g, " ")
        // Insert a space before all capital letters, to handle CamelCase
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        // Uppercase the first character of each word
        .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
    );
  };

  const removeTrailingTerminate = (str) => {
    const suffix = "TERMINATE";
    return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
  };

  function sanitizeJSONString(str) {
    return str
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/\f/g, "\\f")
      .replace(/\b/g, "\\b");
  }

  return (
    <>
      <Head>
        <title>AutoGen Chat</title>
        <meta name="description" content="Autogen chatbot" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.topnav}>
        <div className={styles.navlogo}>
          <a href="/">AutoGen</a>
        </div>
        <div className={styles.navlinks}>
          <a href="https://microsoft.github.io/autogen/" target="_blank">
            Docs
          </a>
          <a href="https://github.com/ShaneYuTH/autogen" target="_blank">
            GitHub
          </a>
        </div>
      </div>
      <main className={styles.main}>
        <div className={styles.cloud}>
          <div ref={messageListRef} className={styles.messagelist}>
            {messages.map((message, index) => {
              return (
                // The latest message sent by the user will be animated while waiting for a response
                <div
                  key={index}
                  className={
                    message.type === "userMessage" &&
                    loading &&
                    index === messages.length - 1
                      ? styles.usermessagewaiting
                      : message.type === "apiMessage"
                      ? styles.apimessage
                      : styles.usermessage
                  }
                >
                  {/* Display the correct icon depending on the message type */}
                  {message.type === "apiMessage" ? (
                    <Image
                      src="/roboticon.png"
                      alt="AI"
                      width="30"
                      height="30"
                      className={styles.boticon}
                      priority={true}
                    />
                  ) : (
                    <Image
                      src="/usericon.png"
                      alt="Me"
                      width="30"
                      height="30"
                      className={styles.usericon}
                      priority={true}
                    />
                  )}
                  <div className={styles.markdownanswer}>
                    {/* Messages are being rendered in Markdown format */}
                    <ReactMarkdown linkTarget={"_blank"}>
                      {message.message}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.center}>
          <div className={styles.cloudform}>
            <form onSubmit={handleSubmit}>
              <textarea
                disabled={loading}
                onKeyDown={handleEnter}
                ref={textAreaRef}
                autoFocus={false}
                rows={1}
                maxLength={512}
                type="text"
                id="userInput"
                name="userInput"
                placeholder={
                  loading ? "Waiting for response..." : "Type your question..."
                }
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className={styles.textarea}
              />
              <button
                type="submit"
                disabled={loading}
                className={styles.generatebutton}
              >
                {loading ? (
                  <div className={styles.loadingwheel}>
                    <CircularProgress color="inherit" size={20} />{" "}
                  </div>
                ) : (
                  // Send icon SVG in input field
                  <svg
                    viewBox="0 0 20 20"
                    className={styles.svgicon}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                  </svg>
                )}
              </button>
            </form>
          </div>
          <div className={styles.footer}>
            <p>
              Powered by{" "}
              <a href="https://microsoft.github.io/autogen/" target="_blank">
                Autogen
              </a>
              . Built by{" "}
              <a href="https://github.com/ShaneYuTH/" target="_blank">
                Shane Yu
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
