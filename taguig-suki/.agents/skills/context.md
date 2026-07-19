AI-ENHANCED MOBILE WET MARKET APPLICATION
IN TAGUIG PEOPLE'S MARKET
A Capstone Project
Submitted to the Faculty of the
Institute of Information and Computing Technology
In Partial Fulfillment
of the Requirements for the Degree of
Bachelor of Science in Information Technology
Binuya, Jayzen
Clapis, Jay Jay
Estonillo, Nelson
Indonilla, Rejie
Larioza, Elizabeth
May 2026
 
TABLE OF CONTENTS
TABLE OF CONTENTS ………………………………………………………………...2
CHAPTER 1: THE PROBLEM AND ITS BACKGROUND …………………………4
 Background and Rationale of the Study ………………………….………………4
Objectives of the Study …………………………………………………………..6
Significance of the Study …………………………………………………………7
Scope and Limitation of the Study ……………………………………………….8
Conceptual Framework of the Study ……………………………………………10
Definition of Terms ……………………………………………………………...13
CHAPTER 2: REVIEW OF RELATED LITERATURE AND STUDIES ………….16
Related Literature ………………………………………………………………..16
Local Literature ………………………………………………………….16
Foreign Literature ...………………………………………….………….19
Related Studies …………………………………………………………….…….22
Local Studies …………………………………………………………….22
Foreign Studies ………………...………………………………………..24
Synthesis ………………………………………………………………………...27
CHAPTER 3: RESEARCH DESIGN AND METHODOLOGY …………………….29
Research Design …………………………………………………………………29
Sampling Technique…….………………………………………………………..30
Participants of the Study ………………………………………………………...31
Research Locale………………………………………………………………….32
Research Instrument……………………………………………………………..34
Data Gathering Procedure……………………………………………………….35
System Development Process……………………………………………………36
System Architecture……………………………………………………………...39
Data Analysis…………………………………………………………………….40
Ethical Considerations…………………………………………………………...60
REFERENCES ………………………………………………………………………….62
2
TABLE OF FIGURES
Figure 1. Input-Process-Output (IPO) Model …………………………………………...10
Figure 2. Agile Model of the Study……………………………………...………………29
Figure 3. System Architecture of the Study ……………………………………………..39
Figure 4. Data Flow Diagram (DFD) Level 0 …………………………………………...43
Figure 5. Data Flow Diagram (DFD) Level 1 …………………………………………..44
Figure 6. User Login and Registration ………………………………………………….46
Figure 7. Recipe and Vendor Selection ………………..………………………………..47
Figure 8. Order Checkout and Payment ………………………………………………...48
Figure 9. Updating Inventory……. ……………………………………………………..49
Figure 10. Use Case Diagram……………………………………………………………51
Figure 11. Entity Relationship Diagram ………………………………………………...52
Figure 12. Main Screen………………………………………………………………….53
Figure 13. Explore Screen (Market & Ingredient View)...................................................54
Figure 14. Recipe Screen……………………………………………………...…………55
Figure 15. Cart Screen…………………………………………………………………...56
Figure 16. Order Tracking Screen……………………………………………………….57
Figure 17. User Profile Screen…………………………………………………………..58
Figure 18. Create Account and Sign In Screen………………………………………….59
List of Tables
Table 1. Participants of the Study………………………………………………………..32
Table 2. Likert Scale Interpretation………………………………………..…………….42
3
CHAPTER I
INTRODUCTION
Background and Rationale of the Study
Wet markets, or "Palengke" in the Philippines, are a fundamental part of
every day and cultural life for Filipinos. As the primary source of food items like
meat, fish, fruits, vegetables, and spices at an affordable cost, they play a crucial
function in providing people with healthy and nutritious foods (Food and
Agriculture Organization, 2021). Consumers prefer wet markets due to their
low-cost options when compared to supermarkets, the freshness of the produce,
and the ability to interact personally with the vendors. Additionally to being a
source of food accessibility, wet markets provide vital economic functions to
farmers, fishers and small entrepreneurs who live in those communities. However,
wet markets still use traditional ways of conducting business such as manual,
face-to-face bargaining, handwritten pricing and individual transactions which
ultimately create inefficiency and irregularities for customers (Department of
Agriculture, 2022).
According to Statista (2024), the tremendous growth in consumer use of
mobile technology and digital platforms in recent years is changing how
consumers shop for goods and services. With the rise of consumer purchasing
through mobile applications and online systems that allow quick product searches,
comparisons, and purchases using mobile technology has made shopping faster
and easier. Retailers such as supermarkets and large retailers have also capitalized
on e-commerce and digital inventory systems to improve efficiency for customers
4
and themselves. Thus, this shows an obvious difference between new and old
methods, demonstrating the need to modernize and enhance operational
performance within the wet markets business model. Improving operational
efficiencies in wet market business models corresponds with Sustainable
Development Goal #9, which emphasizes innovation, sustainable infrastructure
and technology (United Nations, 2015). Furthermore, AI provides opportunities to
improve operational efficiencies and customer experiences through features such
as customized product recommendation to include product matching to specific
user requirements or dietary restrictions (IBM, 2023).
The Taguig People's Market is among the largest public markets located in
Taguig City and is primarily used by residents from nearby areas. Customers must
physically go to each separate stall to perform all of their purchasing activities
which could take considerable amounts of time particularly if a person wants to
buy all of the ingredients needed for a single meal. In response to these
challenges, this study proposes the development of an AI-Enhanced Mobile Wet
Market Application in Taguig People’s Market. The system aims to modernize the
traditional wet market experience by allowing users to select recipes,
automatically generate ingredient lists based on available inventory, and place
orders directly through a mobile application. This proposed solution intends to
improve customer convenience during purchasing processes, enhance vendor’s
operational efficiencies, sales opportunities and assist in transforming traditional
wet markets into digital wet markets consistent with United Nation's Sustainable
Development Goals #11 & #17 (United Nations, 2015).
5
Objectives of the Study
This study aims to develop an AI-Enhanced Mobile Wet Market
Application for Taguig People’s Market that improves the efficiency,
convenience, and accessibility of wet market transactions through AI-assisted
product selection and mobile ordering features. To achieve this goal, the research
pursues the following specific objectives:
● To develop a mobile application that offers users an easy-to-use
interface to view, search, and make purchases of items found in the
wet market.
● To design and implement an AI-based recipe suggestion feature that
utilizes information about what consumers like, need or have ordered
previously as a basis for suggesting recipes.
● To develop an automated ingredient generation system that generates
automatically a list of ingredients that are needed for every selected
recipe.
● To create an integrated ordering and transaction system that would
allow users to order ingredients from several different vendors located
throughout the wet market.
● To evaluate how well the developed system meets requirements for
usability, functionality, efficiency and user satisfaction in order to
assess if it improves the experience of shopping at a wet market.
6
Significance of the Study
This study is significant as it offers a new way to update the operation of
traditional wet markets using mobile technology and AI. This study will create a
system that enhances both customer satisfaction with the shopping experience and
reduces customer waiting times by providing an efficient means for customers to
locate ingredients as well as placing orders in a timely manner. The data collected
from this project will positively affect many stakeholders such as consumers,
vendors, and researchers in addition to the local community.
For Consumers. The consumers will benefit from the ease and speed of
selecting and ordering ingredients via the mobile application. By putting a recipe
into a mobile app consumers can easily get a list of what they need from their
phone. Since the user can access the mobile app at any time and anywhere, it
would benefit those with busy lives such as working professionals, students and
stay-at-home moms who do not often have enough time during the day to create
meal plans and go shopping.
For Vendors. The digital platform will enable local vendors to increase
their exposure digitally and provide them with opportunities to display their goods
and services on-line, process orders efficiently and increase revenue. In addition,
the utilization of the system will enable vendors to process their daily tasks more
efficiently, reduce manual labor required, and adapt to the current trend toward
doing business digitally.
For Market Administrators. With the development of the digital
platform, the administrator will be able to obtain better knowledge of demand for
7
specific products, customer needs, usage, and trends in transactions. These data
points will enable administrators to make informed decisions regarding the
operational aspects of their markets..
For Local Community and Economy. The successful implementation of
the system will contribute to the digital transformation of wet markets in the
Philippines. The modernization of wet market operations will support economic
development in the region, provide access to technology for small businesses and
stimulate innovation throughout the community. Additionally, the system will
assist in bridging the gap between traditional shopping methods and modern
shopping methods and enhance the competitiveness of wet markets in the digital
marketplace.
For Researchers and Future Developers. This research provides a
valuable benchmarking tool for potential researchers and developers interested in
AI applications relating to mobile apps used in the context of traditional
marketplace environments. The foundation established by this work will
potentially influence future researchers to explore further smart market places,
recommenders and e-commerce solutions in regional contexts.
Scope and Limitation
This study focuses on the design, development, and evaluation of an
AI-Enhanced Mobile Wet Market Application intended for the vendors and
consumers of Taguig People’s Market and is exclusively accessible to residents of
Taguig City. The system is designed to provide a mobile-based platform that
8
allows users to register accounts, log in securely, browse available market
products, receive AI-based recipe recommendations, view the ingredients needed
for selected meals, select preferred vendors, add items to the cart, and place orders
through the application. The system also includes product and inventory
management modules for vendors, allowing them to add, update, and manage
available items within the platform. The AI component of the system is designed
to analyze user meal preferences and generate recipe suggestions based on the
available ingredients stored in the system database. The proposed system will be
developed as a mobile application supported by a secure database for data storage
and retrieval. The system will be evaluated in terms of functionality, usability,
reliability, and overall user experience.
The proposed system is limited to recipe recommendation, product
browsing, ingredient generation, vendor selection, and order placement
functionalities only. The AI recommendation feature is limited to the recipes,
ingredients, and predefined datasets stored within the system database and may
not fully accommodate all user preferences, dietary restrictions, or specialized
meal requirements. The system requires a stable internet connection for proper
access and real-time processing of information. Delivery management, rider
tracking, and logistics operations are not included in the system. Payment
processing may be limited to simplified transaction methods during system
development and testing. Real-time inventory updates depend on vendor input
and may not always reflect actual product availability immediately. The study is
conducted specifically for Taguig People’s Market and may require further
9
modifications before implementation in other wet market environments. System
testing will be limited to selected respondents and may not cover all possible user
scenarios or technical conditions.
Conceptual Framework
This study on the AI-Enhanced Mobile Wet Market Application in the
Taguig People's Market is guided by the Input–Process–Output (IPO) model,
which illustrates the flow of the system from the initial requirements up to the
expected outcome. The framework explains how data, processes, and system
functions interact to produce an improved and more efficient wet market
transaction system
Figure 1. Conceptual Framework of the Study
Beginning with the input, the proposed system is reliant on a combination
of hardware, software, and knowledge or informational resources in order to
10
implement and operate effectively. Software will be represented by the mobile
application system, the database management system, the AI recommendation
module and all other tools used during the design process to execute the
transaction, manage inventory levels, store customer records and generate
recommendations based on recipes. The knowledge includes the user profile, a
database of recipes, databases of vendors and products, inventory levels,
availability of ingredients, ordering history and system requirements. The data
and information resources provide the input to support system processing and
decision making.
In developing this system we are using the Agile methodology, allowing
us to develop iteratively, continuously improve our products, and receive and
integrate user feedback into the software development life cycle on an ongoing
basis.
The Agile process includes the following phases:
● Requirements Gathering – Identification of user needs such as
recipe-based ordering, vendor listing access, and real-time
ingredient availability.
● System Design – Planning of system architecture, including mobile
interface design, database structure, and AI recommendation
workflow.
● Development (Sprint-Based Coding) – Implementation of system
modules such as recipe selection, ingredient matching, vendor
selection, and order processing in iterative cycles.
11
● Testing – Evaluation of system functionality, accuracy of AI
recommendations, and performance of real-time updates.
● Review and Feedback – Collection of feedback from users and
vendors through prototype testing and simulation.
● System Refinement and Maintenance – Continuous improvement
of system features, bug fixing, and enhancement of AI accuracy
based on feedback and usage data.
The output stage represents the results generated after processing all inputs
through the system. The primary output is the AI-Enhanced Mobile Wet Market
Application which provides users with a mobile platform that automatically
generates ingredient lists based on selected recipes and recommends available
vendors within the wet market. The system also enables real-time ordering and
transaction processing, ensuring a more efficient and organized shopping
experience. Additional outputs include AI-generated ingredient recommendations,
updated inventory records, vendor suggestions, and transaction summaries that
support both users and vendors in managing purchases and stock more effectively.
A feedback mechanism is also integrated into the system to ensure
continuous improvement and adaptability. User feedback, transaction history, and
system performance data are collected and analyzed to enhance the accuracy of
the AI recommendation module and improve ingredient matching. Vendor updates
and changes in product availability are continuously synchronized with the
database to maintain real-time accuracy.
12
Definition of Terms
For the readers to fully comprehend this study, the following are the
notable terms that have been utilized in the study:
Operational terms
AI-Enhanced Mobile Wet Market Application. The proposed mobile
application that integrates AI to improve the transactional process of a wet market
in recommending recipes and in taking orders.
Automated Ordering System. A system feature allowing users to make
purchases from their mobile device.
Ingredients. A food necessary for making or creating a recipe. All
ingredients are stored and linked within the database.
Order. The users' requests to purchase specific quantities of ingredients.
Recipe. A set of instructions for preparing a dish, including required
ingredients and cooking procedures.
Recipe-Based Ingredients Recommendation. An automated feature that
recommends ingredients based upon the user selecting a recipe.
Transaction. The finalization of purchasing between the vendors and
consumers through the system.
User. Consumers of the product that utilize the mobile app for searching
and purchasing ingredients.
Vendor. Sellers in the wet market that sell products, have listings of
products available for sale, and participate in the system.
13
Wet Market. A traditional marketplace where fresh food items are sold,
specifically referring to the Taguig People's Market in this study.
Technical terms
Algorithms. Sets of steps taken by the system to analyze data and create
output, such as providing recommendations to users.
Application Programming Interface (API). A set of rules that allows
different software systems to communicate and exchange data within the
application.
Artificial Intelligence (AI). Refers to computer systems capable of
performing tasks that typically require human intelligence, such as learning,
reasoning, and decision-making. In this study, AI is used to generate recipe
recommendations and ingredient lists.
Cloud Computing. The use of remote servers over the internet to store,
manage, and process data, which may be used in this system for scalability and
storage.
Data Processing. Collection, organization and transformation of data to
useful information for end-users.
Database. Organized collections of electronic data. The databases herein
include recipes, ingredients and consumer/user information.
Mobile Application. Software programs developed to operate on mobile
devices. Users can access certain functionality, such as viewing recipes and
submitting orders from their mobile devices.
14
Recommendation System. An AI-based system that suggests relevant
content to users, such as recipes based on user preferences.
System Architecture. The architecture of a computer system refers to
how all parts of the system are organized and function in relation to one another.
User Interface (UI). The visual elements of the application that allow
users to interact with the system, including buttons, menus, and display screens.
15
CHAPTER II
REVIEW OF RELATED LITERATURE
This chapter presents a review of related literature and studies that support
the development of the AI-Enhanced Mobile Wet Market Application in Taguig
People's Market. It examines both local and foreign sources to provide an
understanding of concepts related to artificial intelligence, mobile applications,
and digital marketplace systems. The review connects existing knowledge with
the proposed system and highlights how these technologies can improve
efficiency, accessibility, and user experience. It also identifies gaps in existing
studies, particularly the lack of integrated systems that combine AI-based recipe
recommendations with automated ingredient ordering in traditional wet market
environments in the Philippines, thereby justifying the need for the proposed
system.
Local Literature
In the Philippines, digital technologies have slowly changed the way
traditional businesses do business - especially in the areas of commerce and
delivery of service. Digitalization is often seen as an effective means for allowing
for greater efficiency and accuracy and providing the customer with greater
satisfaction (Reyes et al., 2020). Many traditional marketplaces, including
everyday wet markets, are dependent upon manual transactions, including
handwritten records, verbal communication and in-person exchanges. These types
of transaction methods create an opportunity for delays, miscommunication and
human error which negatively impact not only the vendor but also the consumer.
16
The establishment of digital systems can help to reduce these types of challenges
by automating routine processes, organising data in a more effective manner and
improving upon the overall reliability of a given transaction. In turn, technology
will have a considerable impact on helping to modernise a traditional business
ecosystem and delivery of service.
Mobile applications provide a way for consumers to shop more easily and
conveniently at local stores in their community. With mobile apps, consumers can
buy items and use services on demand via smartphone or tablet. In the context of
wet markets, the mobile app allows consumers to see what is currently available
by product type, compare prices and order from several different vendor's
offerings without leaving their house or office (Santos & Cruz, 2021). This has
made the overall shopping experience less time-intensive and labor-intensive and
provided a much more streamlined and efficient process. Moreover, the mobile
technologies have enabled many small retailers and street vendors to maintain
regular contact with potential buyers. The ability of a vendor to rapidly receive
orders from buyers and subsequently make available what they ordered is
indicative of the role mobile technologies play in facilitating modernized
traditional retailing models.
One key area of improvement identified by authors in local research is the
use of digital systems to improve inventory management. Inventory management
at most wet markets remains manual. For example, many vendors record product
inventory using written lists or mental recall, both of which can be inaccurate. If
inaccuracies occur when recording inventory levels for perishables, vendors may
17
either overstock or understock merchandise; therefore, if vendors utilize digital
inventory management systems, they will have the capability to track inventory in
real-time, update product availability immediately and manage inventory more
effectively than before (Lopez, 2019). Improved accuracy in tracking inventory
enables vendors to make informed decisions about purchasing quantities of raw
materials. Additionally, vendors will reduce waste and improve profitability.
Therefore, improving digital inventory management processes will provide one
method to enhance operational efficiencies within traditional markets.
The rapid expansion of mobile commerce reinforces the necessity of
digital transformation of traditional market spaces. Mobile-based systems have
become more available to a greater user base due to greater access to the Internet
and the proliferation of smart phone usage. Mobile-based systems also increase
the efficiency of transactions while extending the reach of businesses beyond their
physical storefronts (Cruz et al., 2021). An example of this can be found in wet
markets , where vendors will now have more opportunities to provide customers
with flexible, convenient shopping alternatives, while providing vendors the
ability to serve more customers. Additionally , mobile commerce enhances
customer satisfaction by streamlining the purchase process and eliminating the
constraints of time and place when making purchases. As a result, these
advancements will aid in the continued evolution towards the implementation of
digital solutions into traditional market environments, thereby improving overall
quality of service and operational effectiveness.
18
Foreign Literature
Using modern AI systems has made a great improvement in how digital
systems work today, mostly through increased efficiency and improved end user
experience. AI also allows digital systems to analyze large data sets, create
patterns, and create intelligent responses that are comparable to those made by
humans. Therefore AI allows digital systems to conduct more sophisticated
functions that require predictive modeling and recommendation generation with
much greater accuracy and speed than traditional approaches. According to
Russell and Norvig (2021), AI is vital to the creation of intelligent processing
applications. The existing advancement in AI applications include everything
from recommendation systems to automated purchase processing platforms. In
total, because of these types of applications, AI enables the development of digital
systems that have greater levels of operational efficiency and responsiveness.
Digital platforms utilize recommender systems as an extremely popular
type of Artificial Intelligence application. Recommender systems collect user
behaviour, preferences and earlier interactions to produce tailored suggestions to
fulfil their individual needs. Recommender systems aid users in their
decision-making within the online environments by offering choices of relevant
options and avoiding the need for extensive searching. Ricci et al (2015) state that
this type of technology will increase user retention and overall satisfaction with
the use of tailored content and recommendations. Within food-related
applications, Recommender Systems can provide users with recipe options and
19
the required ingredients for the recipe, thus enhancing the efficiency and ease
involved in making selection decisions.
Mobile Commerce has transformed the way consumers connect to and
transact with businesses, facilitating users’ ability to access products and services
anytime and anywhere with no limitations to physical location or operation hours.
According to Turban et al (2018), Mobile Technologies enhance user accessibility
and convenience through the ability to perform seamless transactions using
mobile devices. This is especially applicable to systems that facilitate the sale of
products, allowing users to browse, choose and order products in more flexible
and efficient means. Mobile commerce has, therefore, become integral to modern
digital business systems.
By utilizing artificial intelligence to automate system processes; the
performance of the overall system becomes better due to fewer manually-done
activities. Automation in an automated system includes many types of limited
human involvement in many routine tasks associated with ordering, data
management, processing transactions, etc. Continuous automated processes
decrease the chance of error while also improving the speed and consistency of
the processes being performed. According to Davenport and Ronanki (2018),
businesses that utilize automation driven by AI will have benefits such as higher
productivity, efficiency, and lower costs. Automated processes guarantee that the
completion of systems are both accurate and efficient when performing ordering
and data management activities
20
Intelligent systems provide a user of the system with data-based
information and recommendations, therefore resulting in better-informed
decisions being made. Intelligent systems can analyze the data that is available to
them and create conclusions regarding the data, which creates suggestions for
how to approach certain questions associated with making decisions. O'Leary
(2013) stated that by providing accurate and timely information to the user of an
intelligent decision support system will lead to enhanced quality of
decision-making. This is critical for applications that require planning and
selection, such as selecting recipes and ingredients. By providing users with the
processes to complete their decisions, intelligent systems will increase the overall
usability and user's experience.
The literature from other countries supports the idea that there is a high
degree of value in combining artificial intelligence, recommendation systems,
mobile technologies, and automation when creating a modern digital platform.
The integration of these technologies allows for increased efficiencies,
personalized services, and accessibility of services to users while providing a
more responsive system to the user's needs. The studies analyzed in these
literature reviews provide a strong theoretical basis for the proposed system that
will integrate these technologies into one cohesive platform which improves wet
market transactions and delivers a more efficient and intelligent overall user
experience.
21
Local Studies
In the Philippines, there has been considerable research on how digital
technologies can make improvements in traditional systems including business
processes and service delivery. Many local systems are still produced through
manual means which creates slow transaction processing, inaccuracies in data,
and inefficiencies in managing business-related information. As noted by De
Guzman et al (2020), utilizing digital systems will help improve these operations
as well by incorporating automating record-keeping, transaction processing, and
storing of data which will lead to quicker service to customers; more accuracy in
data; and improved organization of the workflow in businesses. The digital
transformation of local commercial settings, particularly in small scale
marketplace environments, has a significant impact on operational efficiency and
customer satisfaction.
Mobile-based systems have also been widely studied in the local context
due to their ability to provide convenience and accessibility to users. These
applications enable users to transact at any point of time and from any location
which makes it possible to do away with a physical presence in business premises.
Villanueva et al. (2021) emphasized that the use of mobile apps is especially
beneficial in classic retail settings because consumers typically have to visit
several stores or merchants to make a purchase. In contrast to visiting many
different shops to buy what they want, mobile app users can search through all
available products on one single platform. Mobile apps provide an additional
benefit as well; they give users the opportunity to compare product prices
22
side-by-side. By doing so, mobile apps improve the entire consumer purchasing
process.
Inventory management has also been discussed in a number of local
studies, particularly when discussing how small vendors would benefit from
better inventory operating practices. For example, many vendors in wet markets
are still using traditional record keeping, including handwritten records, to keep
track of their inventory. Reyes and Santos (2019) further explain that this
traditional record keeping lends itself to a multitude of problems, from
overstocking to understocking of goods and inaccurate inventory records. Digital
inventory tracking systems provide data on real-time inventory updates and are
able to provide far greater data accuracy when tracking inventory. This is
particularly important for perishable products commonly found in wet markets, as
it helps reduce waste and improve overall product management.
Additionally, this shift to mobile e-commerce within the Philippines is an
example of how consumer behavior is evolving. In light of increased smartphone
ownership, and therefore widespread use of smart phones, there has been an
increase in the number of individuals that use their mobile devices for various
forms of everyday transactions, including purchasing items through online
applications. As Cruz et al. (2022) pointed out, "mobile commerce allows
businesses to reach a broader audience than they could with traditional means of
marketing. Mobile Commerce also offers customers faster, and more convenient
methods of accessing and acquiring the products or services they need.
23
Furthermore, there has also been an interest in intelligent systems as a way
of increasing decision making capabilities and improving user experience within
local studies. Mendoza et al. (2021) found that through using intelligent systems
that provide consumers with AI-generated product recommendations based upon
their previous purchases; this allows users to generate tailored recommendations
that fit their unique requirements. This is particularly useful in relation to
food-based services and applications, i.e., item selection when seeking out
recipes. The use of intelligent systems to recommend products to users will enable
them to quickly make better decisions and ultimately enhance the effectiveness
and usability of all digital platforms.
While there are some emerging examples of the adoption of digital
technologies locally, such as those used in wet markets, most have not yet
transitioned to utilizing comprehensive solutions. Current digital solutions
primarily focus on single functions or characteristics rather than integrating
several functionalities into a single application. As such, it appears there exists an
opportunity for developing a more complete solution that incorporates mobile
technology, automation, and smart recommendation capabilities to improve both
efficiency and customer satisfaction in wet markets.
Foreign Studies
Studies on foreign artificial intelligence have demonstrated through
consistent results that artificial intelligence has been an important component for
enhancing the capabilities and intelligence of current digital systems. Artificial
Intelligence provides these systems with the ability to process vast amounts of
24
data, recognize patterns and produce predictions or recommendations based upon
user requirements. According to Li et al. (2020), the ability of AI systems to learn
from user activity and improve their output will result in an extremely high level
of effectiveness for those applications requiring both personalization as well as
decision support. These abilities are also particularly applicable when considering
applications that provide recommendations and automate processes; in these
cases, being accurate and adaptable are critical components.
Recommender systems are studied by many researchers from around the
world for their ability to help deliver a better experience for users who engage
with the digital world. The way these systems provide users with relevant items,
services and experiences is through the analysis of their preferences, historical
usage and user behaviour patterns to create targeted recommendations. According
to Adomavicius and Tuzhilin (2005), recommender systems reduce the amount of
work a user must do to find suitable alternatives and thus improve the user's
ability to make better decisions. In e-commerce and similar applications, the use
of recommender systems creates more satisfied users by offering them
personalized recommendations, which can be utilized in recipe selection and
ingredient suggestion systems, for example.
The use of mobile devices has greatly transformed how end-users access
services and conduct transactions in today’s digital environments. Mobile
applications are an example of this transformation in that unlike past generations
where users have been confined to time and space when completing tasks such as
making purchases or ordering food items, mobile systems enable users to
25
complete these types of tasks at any location and at any time with a mobile
device. According to Sharma and Singh (2020), mobile systems allow end-users
to conduct transactions whenever and wherever they choose via a handheld
device, ultimately increasing convenience. This convenience is particularly
significant when applied to the modern service system, as it facilitates rapid
interactions between end-users and service providers and increases the
accessibility of the service system as a whole.
Automation is an additional area for study as it relates to improving the
efficiency of a system and also to reducing the amount of work done by people.
Brynjliffson and McAfee (2014), highlighted the fact that an automated process
could execute similar tasks over and over again with both high levels of precision
and speed. Therefore, decreasing the possibility of an error being made while
increasing the level of productivity. The use of automation in systems involved
with order entry and data management will provide consistency and reliability for
those processes so users and administrative personnel may direct their attention
towards other, possibly more important, tasks and not toward manually
performing tasks.
Intelligent decision-support systems are another tool widely used within
the foreign literature for providing assistance to individuals who are in need of
making an informed decision. Turban, et al. (2018) describe intelligent
decision-support systems as a class of technologies that can analyse a set of data
and offer a prediction or recommendation to assist the reader with making a
decision. Examples of intelligent decision-support systems used to assist users in
26
developing a food selection plan include being able to determine the number of
viable options based upon existing data and individual preferences. These systems
also allow to create a better overall user experience, since they enable users to
make their own decisions in less time, more efficiently, and with more precision.
Collectively foreign studies demonstrate how artificial intelligence,
recommenders systems, mobile apps, and automation greatly increase both the
functionality and usability of today's modern digital platforms. These
technologies promote personalization, accessibility and system performance thus
placing themselves as key elements of future digital solutions. However, most of
these systems have been created to function at an enterprise level or as
generalized systems. Therefore, there is a need to develop more targeted systems
based on different contexts than just "wet" markets.
Synthesis
Based on the reviewed local and foreign literature and studies, it is evident
that digital technologies, particularly mobile applications, artificial intelligence,
and automation, play a significant role in improving system efficiency,
accessibility, and user experience. Local studies in the Philippines show that many
traditional processes used today, particularly in wet markets and small business
environments are still manually performed. Although some improvement has been
noted in areas like transactional processing, mobile access and inventory
management; current local systems typically have limitations in terms of their
scope and generally focus on just one aspect at a time. The fact that digital
solutions are already being used locally but not being used in a completely
27
integrated manner to meet all of the requirements of users in a traditional market
setting is an area that presents a significant opportunity for innovation.
On the other hand, foreign studies present more advanced applications of
artificial intelligence, recommender systems, and mobile commerce. Examples
from these studies demonstrate how AI may be used to analyze user behavior and
create individualized suggestions based on those behaviors and use those same
analyses to aid in decision making processes. Moreover, mobile technology and
automation offer greater convenience and improved operational efficiency
through mobile accessibility and reduction of manual labor. However, most
foreign systems were created for use in large scale or general purpose applications
rather than developing a specific application for the localized environment of a
wet market. Users in these types of locations require customized applications that
address unique customer needs and operating conditions.
In summary, while both local and foreign research confirm that the
integration of digital technologies into modern systems will improve them, there
is still a significant gap between the availability of a fully integrated platform that
utilizes AI to make recommendation to users, provides mobile access, automates
order entry, and addresses the needs of users in traditional market settings. It is
this gap that identifies the need for the AI-Enhanced Mobile Wet Market
Application in Taguig People’s Market and its goal of creating an even more
efficient, intelligent and user-centered experience for both vendors and customers.
28
CHAPTER III
METHODOLOGY
Research Design
This project follows a developmental research design by systematically
designing, developing and evaluating a technology-based solution for improving
current processes involved within wet market transaction systems. Developmental
research is suitable for this project as it deals with the creation and development
of a functioning system that incorporates artificial intelligence and mobile
technology, to help solve specific real world problems. In this context, the study
aims to develop an AI-Enhanced Mobile Wet Market Application in Taguig
People's Market, that increases the efficiency, accessibility and overall experience
of shopping at a traditional wet market.
Figure 2. Agile Model of the Software Development Life Cycle
The study utilized the Agile methodology to assist in the development
process of the proposed technology-based solution. Agile supports iterative and
29
incremental system development. Through repeated cycles of planning, designing,
developing, testing, deploying and reviewing the system, Agile allows the
researchers to continually refine the system as needed, to meet the needs of both
users and improve the overall functionality of the developed system. Additionally,
the flexible nature of Agile allowed the proponents to make adjustments and
implement improvements during the entire development lifecycle.
Additionally, the study used a mixed-methodology to collect and evaluate
data. The quantitative methods were used to gather data such as; test results for
the developed system, performance measures for the developed system and user
ratings or evaluation scores for usability, accuracy and efficiency. The qualitative
methods were used to gather information through user feedback, observations and
interviews. The combination of both quantitative and qualitative methods
provided a complete analysis of the developed system.
Sampling Technique
This research uses a non-probability sampling technique which is
purposive sampling when selecting individuals to be involved in evaluating the
proposed system. Purposive sampling was appropriate as it enabled the
researchers to select respondents based upon specific attributes or experiences that
were needed for the purposes of the research. Participants need to have some
familiarity with wet market transaction processes and have the ability to interact
with mobile-based systems.
30
The sample group will include both customer and vendor respondents at
Taguig People's Market. Customer respondents will be identified by virtue of
having regularly purchased wet market items and having had experience using
mobile application technology so as to provide an end-users' view of whether the
system is usable, convenient, and functional. Vendor respondents will be selected
based on their active participation in selling and managing wet market products,
which will enable them to provide an assessment of how well the system would
work in practice.
Participants of the Study
The participant group consists of a sample of individuals that represent
both users and evaluators of the new system. The participants include customers
and vendors that have enough experience with wet market activities and use of
mobile applications.
Customers were selected as the main users of the new system as it is
intended for them to select recipes from the application, view ingredients needed,
and place an order. Customers' input is critical to evaluate the usability and
convenience of the system, and overall user experience. Vendor respondents were
selected to provide input on how well the systems perform in regards to listing
products for sale, managing inventory, processing orders, and handling
transactions in real time. Vendors' comments are also important to determine if the
system can help support and improve their business practices in the wet market
environment.
31
Participants were selected through a purposive sampling method to ensure
all participants are directly related to the goals and objectives of the study. A
purposeful selection process will allow researchers to collect meaningful, reliable
data concerning the usability, performance, and effectiveness of the system to
enhance or otherwise improve wet market activities.
Type of Participant Description Number of Respondents
Customers Primary users of the system who
utilize the mobile application for
recipe selection, ingredient
viewing, and ordering of wet
market products.
30
Vendors Active sellers in the wet market
who manage product listings,
inventory, and order fulfillment
within the system.
20
Total 50
Table 1. Participants of the Study
Research Locale
The research locale in this study will be located at Taguig People’s
Market, which is a well known public or wet market in Taguig City within Metro
Manila. Taguig People’s Market has been selected as one of the primary sites
where fresh produce and other essential household items like fish, meat, fruits,
32
vegetables are sold by vendors. Due to its location as a major source of
reasonably priced fresh produce for consumers in Taguig City and its surrounding
area, many residents who live near the market regularly visit the Taguig People’s
Market to purchase the necessities they need on an ongoing basis.
The choice of Taguig People’s Market as the research locale is based on its
relevance to the objectives of the study, which focuses on improving traditional
wet market transactions through an AI-enhanced mobile application. Wet markets
are representative of the real world environment in which customers engage in
face-to-face interaction while shopping for products, manually select merchandise
they wish to buy, and negotiate prices directly with product sellers. Given these
features, it is an ideal location for testing a technology designed to bring elements
of digitalization and automation to the operation of wet markets, and also provide
customers with recipe-based purchasing options.
Furthermore, the location provides direct access to both target respondents
of the study, specifically customers who regularly purchase goods and vendors
who actively manage and sell products within the market. This will allow
researchers an opportunity to observe how real-world business-to-consumer
transaction activity takes place between buyers and sellers and how businesses
monitor and maintain their inventory and communicate with their consumers.
Thus, this approach allows for the testing of the feasibility and effectiveness of
the proposed system within a realistic environment. Conducting this study in
Taguig People's Market increases the validity of the results of this research.
33
Research Instrument
The researchers will develop survey questionnaires that serve as the
research tool to collect data and measure the acceptability and effectiveness of the
proposed system. The researcher-designed questionnaire will assess the feasibility
of the proposed system based on its functionality, usability, efficiency, reliability
and user satisfaction.
A survey questionnaire will be given to selected respondents who have
been introduced to and evaluated the proposed system. The questionnaire will be
provided through an online platform so that respondents can easily complete it on
their smartphone, tablet, or computer. An online survey is expected to make data
collection more effective, easier for access, and quicker..
The responses gathered from the participants will be measured using a
four-point Likert Scale. The scale consists of the following: 4 – Strongly Agree, 3
– Agree, 2 – Disagree, and 1 – Strongly Disagree. The use of a four-point Likert
Scale will enable the researchers to determine the respondents’ level of agreement
with each statement presented in the questionnaire. Furthermore, assigning
numerical values to the responses will allow the researchers to analyze and
interpret the data statistically.
In addition to the survey questionnaire, additional open-ended
questionnaires or interviews can be completed with a select group of participants
to gain further insight into their thoughts about the proposed system. Questions
will relate to obtaining participant’s opinions and comments in regards to the
proposed systems’ features, user experience, convenience and potential areas
34
where improvements could be made. The answers to the qualitative portions of
the research instrument will help support and add to the overall qualitative portion
of this research project.
Data Gathering Procedure
The procedures of the data collection will be executed systematically and
orderly to provide reliable data as well as valid and accurate data to support the
research objectives and the goals of developing and evaluating the system. Data
collection will obtain all relevant information needed to evaluate the functionality,
usability, efficiency, reliability and user satisfaction of the proposed system.
The researchers will first get all necessary approvals prior to implementing
the research, researchers will then contact potential participants to describe how
the research is being implemented. The information provided to participants will
include a description of the research's purpose, goals, and methods. Participants
will be required to provide their consent in order to take part after receiving this
information.
The researchers will carry out an initial survey, along with some initial
interviews with a selection of customers or end-users who are involved in
traditional wet markets to obtain the necessary information on their current
practices, preferences and experiences when undertaking wet market purchases.
The results from this first phase of research will provide the basis for determining
user needs and the system's requirements for developing the proposed system.
35
Following the development of the proposed system, the system will
undergo evaluation by selected participants through survey and interview. A
number of both quantitative and qualitative questions will be contained within the
survey. Quantitative elements will include a 4-point likert scale for assessing the
systems' functionalities, usability, efficiency, reliability and user satisfaction.
Qualitative elements will include open ended questions as a means of gathering
participants' ideas or comments regarding their experience with the system. If
assistance is needed, it will be provided so that all participants are able to
understand each question and answer appropriately.
After all responses have been collected, the accomplished questionnaires
will be reviewed, organized, and prepared for analysis. Quantitative data will be
coded and subjected to statistical treatment, while qualitative responses obtained
from open-ended questions and interviews will be examined to identify recurring
themes and insights. The processed data will serve as the basis for evaluating the
effectiveness and acceptability of the proposed system and for formulating
conclusions and recommendations for the study.
System Development Process
The development of the proposed system follows the Agile methodology
using an iterative approach which involves continuous development, adaptation,
and constant evaluation through-out all phases of the project. The methodology
will allow researchers to build the system in small increments by continually
assessing and improving the system components after each phase based upon the
36
results of testing and user feedback. Through the use of this methodology,
researchers will systematically assess, test and refine the proposed system until it
satisfies both the requirements of its end-users and the goals of the project.
The researchers will start the development process with the planning
phase. In this phase, researchers will define and evaluate all the functional and
systems requirements needed to build the proposed application. The researchers
will define the key aspects of the system which include recipe-based ingredient
generation, vendor integration, meal planning and AI-based suggestions. During
this phase, researchers will also identify the limits of the system as well as
identify the necessary resources (e.g., personnel) and data requirements for the
system (e.g., user data, recipe data, etc.).
The second stage after the initial development phase will be the design
phase. In this phase, the overall configuration, layout, and architecture for all
components of the new system will be designed. The design phase includes
creating the user interface for the mobile app, defining how data will be stored in
the database, defining how each part of the system will interact with other parts
and creating an easy-to-use and time-efficient user experience through both the
design of the AI recommendation element and the overall system workflow.
The next phase is development. The researchers will create the desired
functionality and performance characteristics of the proposed solution by
integrating system components and writing code. It will be built iteratively so that
each module or function can be implemented separately and tested at an early
37
point in the project. By doing it this way, the researchers can continuously refine
the functionalities of the systems as they are being constructed.
After the development stage, the system will go through a testing phase.
The purpose of this is to check how well the function of each component of the
system works. In order to do that, we will conduct system testing in order to see if
all features function as they were intended to. Testing will include checking on the
way the recipes are recommended, the way ingredients are generated, how
products match with each other, how orders can be placed and how
recommendations are made by the artificial intelligence used in the application.
All errors, defects and system problems found during the testing phase will be
fixed prior to moving on to the next phase.
The next stage after testing is the deployment stage. In this stage, the
developed software or application will be ready to be implemented and evaluated.
The software can be deployed in a test environment first or provided to limited
users for their use and to obtain their input and feedback on the application's
usability and functionality.
Lastly, there will be an evaluation of the system. All feedback received
from users will be reviewed and analyzed to determine if any changes need to be
made as well as what additional features should be added to the current
application. This information collected from this stage of the study will help
researchers refine the current version of the proposed system as well as develop
new versions of the system.
38
By utilizing the Agile Software Development Methodology, the
researchers will be able to continuously improve the proposed system through
iterative development, ensuring flexibility and responsiveness to user needs
throughout the project development process.
System Architecture
Figure 3. System Architecture of the Study
The proposed system follows a three-tier architecture consisting of the
presentation layer, application layer, and database layer. The system is accessible
through mobile devices allowing customers, vendors, and administrators to
interact with the platform efficiently.
39
The presentation layer serves as the user interface where customers can
browse recipes, search products, order ingredients, and receive recommendations
powered by AI. Vendors can manage product listings and inventory, while
administrators monitor transactions and system activities. The application layer
handles the core functions of the system such as user authentication, AI-based
recipe recommendation, ingredient matching, order processing, payment
handling, inventory management, notifications, and report generation. This layer
processes all requests between users and the database. The database layer stores
and manages all system information including user accounts, vendor details,
recipes, ingredient lists, product inventory, customer orders, payment records, and
transaction history. The database ensures secure and organized storage of
information for real-time access and updates.
The system uses client-server architecture where mobile clients
communicate with the central server through the internet or local network. AI
functionalities are integrated within the application server to provide intelligent
recommendations and improve user experience.
Data Analysis
The data gathered from the respondents will be analyzed through the use
of descriptive statistical techniques for the purpose of organizing, processing and
interpreting the data collected in this study regarding the proposed AI-Enhanced
Mobile Wet Market Application in Taguig People’s Market. To accomplish these
40
objectives, the researchers will employ several statistical tools including
frequency, percent and weighted means to analyze the participant’s responses.
The respondents will utilize frequency and percent to display and
summarize the demographic characteristics of the respondents as well as to show
the distribution or occurrence of responses. By employing these statistical
measures, researchers will be able to represent and interpret the data that are
obtained from the participants.
The formula for percentage is:
Where:
● P = Percentage
● f = Frequency of responses
● N = Total number of respondents
To compute the overall average score for the ratings given to the proposed
system based on usability, functionability, reliability, efficiency, and user
satisfaction an analysis of the ratings provided by each respondent will be
conducted using the weighted mean.
41
Where:
● x̄ = Weighted Mean
● Σfx = Sum of the product of frequency and corresponding weight
● N = Total number of respondents
The data collected will be analyzed by means of a 4-point Likert Scale to
determine how closely each respondent agrees with each proposed system
component.
Scale Mean Range Interpretation
4 3.26–4.00 Strongly Agree
3 2.51–3.25 Agree
2 1.76–2.50 Disagree
1 1.00–1.75 Strongly Disagree
Table 2. Likert Scale Interpretation
The responses received for the open-ended questions from the participants
will be analyzed via thematic analysis. The researchers will evaluate each
42
participant’s response to find a pattern or theme related to their experiences as
users, suggestions and perceptions about the proposed system. Participant
responses that are consistent in concept and viewpoint will be categorized
together based on their content to help the researchers understand common issues,
concerns or common recommendations. These results from the thematic analysis
will then be used to provide additional evidence and explanation for the findings
from the quantitative portion of the research.
The evaluation of the proposed system will occur via evaluation against
five general criteria including function, usability, reliability, efficiency, and
end-user satisfaction. The results of the evaluations will be provided in table
format and interpreted appropriately.
Data Flow Diagram
Figure 4. Data Flow Diagram Level 0 of the Study
The Level 0 Data Flow Diagram (DFD) of the AI-Enhanced Mobile Wet
Market System illustrates the overall flow of data between the system and its
43
external entities which are the Customer, Vendor, and Admin. Customers interact
with the system by searching recipes and products, getting recommendations
based on an AI-generated recipe of their search preferences, and placing orders.
The vendors input updated product and inventory into the system so that the
vendor has up-to-date listings for the products they sell. In turn, the system
provides data about orders and sales to the vendors so that the vendors can track
both the transactions that have occurred and their business performance. Admins
are able to manage the system by user administration and system monitoring.
They are provided with data reports about inventory and transactions within the
system. As such, the DFD illustrates that the system acts as a central point where
information is exchanged, monitored, ordered, tracked, and recommends using AI
for all parties.
Figure 5. Data Flow Diagram Level 1 of the Study
Figure 5 presents the Level 1 Data Flow Diagram of the proposed system.
The diagram illustrates the interaction among the Customer, Vendor, and Admin,
44
as well as the major processes involved in the system. Customers and vendors
first interact with the User Account Management process to register and manage
their accounts, while account information is stored in the corresponding
databases. Customers can then use the AI Recipe Recommendation process to
search for recipes and receive personalized suggestions based on recipe,
ingredient, and recommendation data. Once a recipe is selected, the information is
sent to the Order Management process, where orders are recorded and forwarded
to vendors for fulfillment. Vendors manage product availability through the
Product and Inventory Management process by updating stock information and
maintaining inventory records. The Admin Monitoring and Reporting process
gathers transaction and inventory data from the system to generate reports and
provide monitoring capabilities for the administrator. Overall, the Level 1 DFD
demonstrates how data flows through the system to support user account
management, AI-driven recipe recommendations, order processing, inventory
control, and administrative monitoring.
45
System Flow Chart
Figure 6. User Login and Registration
The User Login and Registration Module serves as the primary access
point of the AI-Enhanced Mobile Wet Market Application, allowing customers,
vendors and administrators to register to use the mobile wet market system by
creating a new user or logging into the system using previously created user and
password. When registering with the system, users have to enter all relevant
information along with entering login credentials and selecting their respective
role. Once this information has been entered it will be verified by the system prior
to storing the provided information within the database. Users who already have
46
an established record can log into the system, where they need to enter their
existing user name and password; which will then be compared to their
corresponding records on file. Once verification takes place the user will be
redirected to a designated dashboard that corresponds to the role they selected
upon registration. Thus, providing each user with authorized entry into the
system. However, if there is no match found, the user will receive an error
message advising them to attempt again.
Figure 7. Recipe and Vendor Selection
The Recipe and Vendor Selection gives the consumer the ability to enter a
meal and get smart recipe suggestions that utilize ingredients already stocked in
the system. The customer will enter their choice of meal and the AI
47
recommendation module will scan for recipes that fit the consumer's entry and the
ingredients needed for each. Once the system determines there are recipes that
meet the criteria, it will determine if the recipe fits what has been entered by the
consumer as an option. In the event no recipe matches the consumer's choices,
they will be requested to enter another food option. If a recipe does match, the
consumer will be asked to pick one of the options provided, at this point the
system will provide a list of all available ingredients and their associated vendors
that currently have them in stock. The consumer will be able to choose their
preferred vendor and ingredient, and then add those chosen items to their
shopping cart so that they can move forward on the next transaction process.
Figure 8. Order Checkout and Payment
48
The checkout and payments module at the end of the purchasing process
of the mobile wet market system allows the customer to see all items that were
picked from their shopping basket before they make their payment. At this point,
the order summary will be shown including all of the items selected, quantities,
prices, and total cost so the customer can ensure the correct selection was made.
Upon completion of the order summary, the customer may choose how he wishes
to pay for his order and the system will enter that customer's payment information
into a secure area of the system. Should the customers attempt to use one of these
methods fail to complete a valid transaction, the customer will have the option to
try again or select one of the other available options for completing a valid
transaction. Once a valid transaction has been completed; an order receipt will be
generated and the details of the transaction will be stored in the systems database.
Figure 9. Updating Inventory
49
Updating inventory starts at login by the vendor and continues on to the
product management module where it will be directed to select product action.
Within this module, the vendor has the capability to either create a new item, edit
an existing item, or delete a current item from their inventory. After updating
products, the system validates each piece of product information to verify it
includes complete, accurate, and consistent information. Validated product
updates will be routed to the administrator for review. The admin reviews the
proposed updates. If the administrator approves the proposed changes, the system
updates the inventory and displays an updated product listing with the requested
changes. Conversely, if the administrator denies the proposed changes, the system
directs the process back to the product management phase where the vendor can
modify and submit the proposed updates again. The process terminates after
successful implementation of approved updates into the inventory system.
50
Use Case Diagram
Figure 10. Use Case Diagram of the Study
The figure represents a Use Case Diagram that describes the interactions
of the customer, vendor and administrator which are the three principal users and
their interaction with the system. The customers are able to register or login,
search or browse products, access product recipes, receive suggestions from an AI
based on products searched and viewed, generate shopping lists with ingredients
for recipes selected, create orders and track orders placed. Vendors manage
products by adding or updating products, updating inventory as well as receiving
51
orders and process transactions. Administrators oversee all aspects of the systems
operations through managing users and vendors, updating system settings,
monitoring transactions, viewing sales reports, handling complaints and feedback,
managing payments, and monitoring AI recommendations. The diagram provides
an overview of the functionality provided to each actor type as well as describes
how these actors are able to interact with the proposed system in order to facilitate
efficient wet market transactions and enhance the user experience.
Entity Relationship Diagram
Figure 11. Entity Relationship Diagram of the Study
The entity relationship diagram is a graphic illustration of the structure of
the proposed system’s database. The diagram represents the organization of data
storage and relationships in the system through identification of the primary
entities and the relationships among them. The diagram further illustrates how
users will be able to place orders and obtain recipes that have been developed
52
using an artificial intelligence recommendation process based on the user's
preferences. In addition, the diagram illustrates the relationship between recipes
and their respective ingredients, these ingredients are directly linked to the
products in inventory contained in the Product Inventory to assist in assuring
availability of all necessary ingredients from the wet market. Finally, the Vendors
who administer and manage vendor specific product information, pricing and
stock levels are associated with the Product Inventory. The ability to manage
inventory allows for real-time tracking of inventory availability and assists in
maintaining up-to-date and consistent inventory records.
User Interface
Figure 12. Main Screen
53
The Main Screen is used as the primary means of accessing all aspects of
the system for the user and provides simple access to Recipes, Ingredients and
Market Information. The Main Screen will include a Location Header at the top of
the page, a Search Bar in the middle of the page, Category Filters on the left side
of the page and a Featured Recipes Section which will show details about each
recipe such as Cost, Time and Ratings. At the bottom of the Main Screen there
will be a Market Hours Panel that will display Operating Hours.
Figure 13. Explore Screen (Market & Ingredients View)
The Explore Screen lets you see what’s available at your local markets as
well as all of the vendors that are currently selling their products. Users can use
the Search Bar, Category Filters, Vendors List with Vendor Ratings and
54
Availability Status or Product Listings including Price and Stock Indicators to
quickly find and select fresh produce from their local vendors.
Figure 14. Recipe Screen
The Recipe Screen will display detailed information about each chosen
dish so users can easily find the needed information for preparing the dishes. The
screen has at the top, the name of the dish, an image of the finished dish, and its
rating; in addition to this, there is a label stating "AI recommended." Below these
are other important pieces of information regarding the dish, which include: the
amount of time required to cook the dish; how many servings you can expect
from this recipe; what the difficulty level of this recipe is; and finally, an estimate
of the total cost of the ingredients for this recipe. In order to assist users in finding
the ingredients they need to buy, the screen provides two options to view this
55
information. Users may toggle back and forth between viewing either the
ingredient list or the preparation instructions on the same screen. When looking at
the ingredient list, the user will be able to see what ingredients are included in the
recipe, how much they will cost, and who carries those ingredients. Also listed is
an "Add All To Cart" option that enables users to instantly place all of the
necessary ingredients into their shopping cart.
Figure 15. Cart Screen (Shopping Cart Interface)
The Cart Screen is an itemized screen that lists all of the items you have
selected to buy in order from Vendor name to pick-up point. Users can see each
product individually on this screen as well as increase or decrease quantities or
delete items off of this list. This cart also includes a sub-total amount for each
item individually.
56
Figure 16. Order Tracking Screen
The Order Tracking Screen allows for easier tracking and management of
user orders. Above that, is the display of current active orders. If no current active
orders exist, the screen will indicate there are no current active orders and include
an "Order Now" link to prompt the user to create a new order. Below this
information are past orders shown on cards with basic information about each
order (such as order #, date, products ordered, total cost and status - e.g.
"delivered"). Each card also has a "Re-Order" option which enables the user to
easily reorder all or some of the products they had previously purchased. Finally
at the bottom of the screen is a menu of links to other areas of the app (Home,
Explore, Shopping Cart, Orders, Profile) to allow users to navigate throughout the
application.
57
Figure 17. User Profile Screen
The screen shot above is an example of how users can see their profiles,
save favorites and browse previous purchases through the TaguigSuki mobile app.
The screen has the user's name, phone number, address, etc. listed at the top and
some general information about them that includes the number of times they have
ordered from TaguigSuki, what items are in their favorites and the number of
reviews they have submitted. Below this area is where you will find a listing of all
your previous orders in chronological order. Each item on this list provides
additional information for each purchase including the date and time it was
placed, the status of the order, the price of the items purchased and if possible
other relevant details.
58
Figure 18. Create Account and Sign In Screen
The Create Account and Sign In sections of the TaguigSuki website were
developed to create an easier, more enjoyable, and more accessible online
experience for both new users and current users.
On the Create Account page, there are fields for full name, phone number,
password, and market area which will be displayed on a clean, uncluttered and
straightforward page allowing for ease of registration with a clearly viewable
"Create Account" button and the ability to register with your Google or Facebook
account if you prefer.
59
In addition, the Sign In section was created so that users can quickly log
into their accounts by simply inputting their phone number and password. This is
achieved through a clean, well-structured format and a large "Sign In" button.
Users also have the option to use their Google or Facebook account to help make
signing in even easier, while they also have the option to click "Forgot Password.
Ethical Considerations
To conduct this project in a responsible, professional, and academically
valid manner; we have established a set of ethics that will guide us in the
implementation and development of the proposed AI-Enhanced Mobile Wet
Market Application in Taguig People’s Market. Below are some of the ethical
issues related to our projects:
Data Privacy and Confidentiality
The proposed system collects user data (e.g., name, address, phone
number) for the purposes of developing and evaluating the system. We will
implement adequate technical means to protect users' personal data against
unauthorized access, use, or disclosure. User data will only be used for the
operation of the system and/or for research purposes. During testing or analysis,
user data will be anonymized so that users cannot be identified.
Informed Consent
Users participating in data collection activities (e.g., surveys, testing of the
system), will receive sufficient information on what kind of data will be collected,
how it will be used and stored, etc. Users are also fully aware that they may
60
participate in the survey/test at their own discretion and can withdraw from the
test/survey at any time without prejudice.
Intellectual Property and Plagiarism
Researchers commit to maintaining academic integrity and follow all
applicable laws and guidelines regarding intellectual property rights. All work
created as part of the project, if not original, will include proper citations
according to current citation styles. All third party tools/technologies included
within the system will be compliant with their respective license agreements and
copyrights.
Cybersecurity and Protection from Harm
In an effort to develop a secure product for our users, we have
incorporated many forms of security into the design of the system. These include
input validation, safe storage of user data, controlled access to various
components of the system, etc. This should help reduce potential areas where
hackers could attack the system and compromise user safety/data security.
Accountability and Integrity
As researchers, we strive to maintain the highest level of honesty,
transparency, and reliability when presenting any data, analysis and/or results.
Data is accurate and true; there is no fabrication, falsification or
misrepresentation. As well, we acknowledge any limitations/constraints
experienced during the development/evaluation process to clearly present an
honest account of our study.
61
Author’s Contributions
REFERENCES
Adomavicius, G., & Tuzhilin, A. (2005). Toward the next generation of
recommender systems: A survey of the state-of-the-art and possible
extensions. IEEE Transactions on Knowledge and Data Engineering,
17(6), 734–749.
Bangko Sentral ng Pilipinas. (2023). Digital payments transformation roadmap
progress report. Bangko Sentral ng Pilipinas
Brynjolfsson, E., & McAfee, A. (2014). The second machine age: Work, progress,
and prosperity in a time of brilliant technologies. W. W. Norton &
Company.
Burke, R. (2019). Hybrid recommender systems: Survey and experiments. User
Modeling and User-Adapted Interaction, 29(2), 1–30.
Cockburn, I. M., Henderson, R., & Stern, S. (2019). The impact of artificial
intelligence on innovation (Working Paper No. 24449). National Bureau of
Economic Research.
62
Name Conceptualization Methodology Software Validation Resources Writing
Binuya, Jayzen ✔ ✔ ✔ ✔
Clapis, Jay Jay ✔ ✔ ✔ ✔ ✔ ✔
Estonillo, Nelson ✔ ✔ ✔ ✔
Indonilla, Rejie ✔ ✔ ✔ ✔ ✔ ✔
Larioza, Elizabeth ✔ ✔ ✔ ✔ ✔ ✔
Cruz, J., Garcia, M., & Santos, A. (2022). Digital consumer behavior in
developing economies: Philippine context. Asia-Pacific Social Science
Review, 22(3), 1–15.
Davenport, T. H., & Ronanki, R. (2018). Artificial intelligence for the real world.
Harvard Business Review, 96(1), 108–116.
De Guzman, M. T., Reyes, A. J., & Lim, R. (2020). Digital transformation in
Philippine small and medium enterprises. DLSU Business & Economics
Review, 30(1), 45–60.
Department of Information and Communications Technology. (2023). Philippine
digital economy report. Government of the Philippines.
Laudon, K. C., & Traver, C. G. (2022). E-commerce 2022: Business, technology,
society (17th ed.). Pearson.
Li, X., Wang, Y., & Chen, H. (2020). Artificial intelligence in modern
recommendation systems. Journal of Big Data, 7(1), 1–20.
Lorenzo, R., & Perez, J. (2021). Mobile commerce adoption in the Philippines.
Philippine Journal of Development, 48(2), 45–67.
Manyika, J., Chui, M., & Bughin, J. (2017). A future that works: Automation,
employment, and productivity. McKinsey Global Institute.
Mendoza, R., Bautista, L., & Navarro, J. (2021). AI-based recommendation
systems for food applications in the Philippines. International Journal of
Computing Sciences Research, 5(2), 112–125.
63
O’Leary, D. E. (2013). Artificial intelligence and big data. IEEE Intelligent
Systems, 28(2), 96–99.
Philippine Statistics Authority. (2022). E-commerce and digital economy
indicators. Philippine Statistics Authority
Power, D. J. (2020). Decision support systems: Concepts and resources for
managers. Greenwood Publishing.
Ricci, F., Rokach, L., & Shapira, B. (Eds.). (2022). Recommender systems
handbook (3rd ed.). Springer.
Russell, S., & Norvig, P. (2021). Artificial intelligence: A modern approach (4th
ed.). Pearson.
Sharma, S. K., & Singh, G. (2020). Mobile commerce adoption and usage.
International Journal of Information Management, 50, 1–10.
Turban, E., Pollard, C., & Wood, G. (2018). Information technology for
management (11th ed.). Wiley.
Villanueva, P., Ramos, K., & Dela Cruz, L. (2021). Mobile application adoption
in local retail systems. Journal of Philippine ICT Research, 14(1), 23–39.
64
INSTITUTE OF INFORMATION AND COMPUTING TECHNOLOGY
CAPSTONE PROJECT APPROVAL SHEET
Name Signature
Binuya, Jayzen ______________________
Clapis, Jay Jay ________________________
Estonillo, Nelson ________________________
Indonilla, Rejie ________________________
Larioza, Elizabeth ________________________
Degree: BSIT Type of Study: Capstone
Title : AI-ENHANCED MOBILE WET MARKET APPLICATION
 IN TAGUIG PEOPLE'S MARKET
RECOMMENDING APPROVAL:
ENGR. KLARENCE M. BAPTISTA, MIT __________
Capstone Instructor Date
A P P R O V E D:
FIRST NAME MI. LAST NAME, MA/MS __________
Chair Panel Date
FIRST NAME MI. LAST NAME, MA/MS __________
Panel Date
FIRST NAME MI. LAST NAME, MA/MS __________
Panel Date
N O T E D:
ENGR. KLARENCE M. BAPTISTA, MIT __________
Dean, IICT Date
65